"""투썸 캡차 OCR 사이드카 서비스.

백엔드(JVM)에서 캡차 이미지 바이트를 받아 6자리 숫자를 인식해 반환한다.
파일럿(100건)으로 검증된 파이프라인:
1) rapidocr-onnxruntime으로 원본 인식. 정확히 6자리 숫자면 반환.
2) 아니면 전처리본(업스케일 + 지역평균 차분 이진화 + 테두리 제거) 생성 후 재인식.
3) 둘 다 6자리 숫자가 아니면 digits=null (호출측에서 새 캡차로 재시도).
"""
import io
from typing import Annotated

import numpy as np
import uvicorn
from fastapi import Body, FastAPI, Response
from PIL import Image, ImageChops, ImageFilter
from pydantic import BaseModel
from rapidocr_onnxruntime import RapidOCR

app = FastAPI(title="twosome-captcha-ocr", version="1.0.0")
ocr = RapidOCR()

# 전처리 파라미터는 파일럿 검증값 그대로 유지
PREPROCESS_SCALE = 4
PREPROCESS_BLUR = 25
PREPROCESS_MARGIN = 28
BORDER_STRIP_PX = 6


class OcrResult(BaseModel):
    digits: str | None


def preprocess(data: bytes) -> Image.Image:
    """지역평균(GaussianBlur)과의 차분으로 글자를 이진화하는 전처리 (prep.py v4)."""
    img = Image.open(io.BytesIO(data)).convert("L")
    w, h = img.size
    img = img.resize((w * PREPROCESS_SCALE, h * PREPROCESS_SCALE), Image.LANCZOS)
    local = img.filter(ImageFilter.GaussianBlur(radius=PREPROCESS_BLUR))
    diff = ImageChops.subtract(local, img)
    bw = np.array(diff.point(lambda p: 0 if p < PREPROCESS_MARGIN else 255, mode="1").convert("L"))
    bw = 255 - bw  # 글자=255, 배경=0
    m = BORDER_STRIP_PX
    bw[:m, :] = 0
    bw[-m:, :] = 0
    bw[:, :m] = 0
    bw[:, -m:] = 0  # 테두리 프레임 제거
    return Image.fromarray(255 - bw)  # 검은 글자/흰 배경


def extract_digits(image_bytes: bytes) -> str | None:
    result, _elapse = ocr(image_bytes)
    if not result:
        return None
    text = "".join(item[1] for item in result).strip()
    if len(text) == 6 and text.isdigit():
        return text
    return None


def recognize(data: bytes) -> str | None:
    digits = extract_digits(data)
    if digits:
        return digits
    prepped = preprocess(data)
    buf = io.BytesIO()
    prepped.save(buf, format="PNG")
    return extract_digits(buf.getvalue())


@app.post("/ocr/captcha", response_model=OcrResult)
async def ocr_captcha(image: Annotated[bytes, Body()]) -> OcrResult:
    # Content-Type은 image/png raw bytes. 인식 불가면 null 반환(안전, 재시도 가능).
    return OcrResult(digits=recognize(image))


@app.get("/health")
async def health() -> Response:
    return Response(content="ok", media_type="text/plain")


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8090)
