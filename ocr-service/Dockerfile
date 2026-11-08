FROM python:3.11-slim

WORKDIR /app

# 빌드/런타임 의존성 설치 (onnxruntime wheel 사용, 컴파일 불필요)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt \
    && pip uninstall -y opencv-python \
    && pip install --no-cache-dir opencv-python-headless

COPY main.py .

EXPOSE 8090

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8090"]
