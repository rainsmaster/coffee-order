#!/bin/bash

# 테스트 데이터 INSERT 스크립트
# 사용법: ./insert-test-data.sh
# 백엔드 서버가 localhost:8080에서 실행 중이어야 합니다.

BASE_URL="http://localhost:8080/api"

echo "=== 테스트 데이터 추가 시작 ==="

# 1. 팀원 추가
echo ""
echo "1. 팀원 추가 중..."
curl -s -X POST "$BASE_URL/teams" -H "Content-Type: application/json" -d '{"name": "김철수"}' > /dev/null
curl -s -X POST "$BASE_URL/teams" -H "Content-Type: application/json" -d '{"name": "이영희"}' > /dev/null
curl -s -X POST "$BASE_URL/teams" -H "Content-Type: application/json" -d '{"name": "박지민"}' > /dev/null
curl -s -X POST "$BASE_URL/teams" -H "Content-Type: application/json" -d '{"name": "최수현"}' > /dev/null
curl -s -X POST "$BASE_URL/teams" -H "Content-Type: application/json" -d '{"name": "정민수"}' > /dev/null
curl -s -X POST "$BASE_URL/teams" -H "Content-Type: application/json" -d '{"name": "강예린"}' > /dev/null
curl -s -X POST "$BASE_URL/teams" -H "Content-Type: application/json" -d '{"name": "윤서준"}' > /dev/null
curl -s -X POST "$BASE_URL/teams" -H "Content-Type: application/json" -d '{"name": "한지우"}' > /dev/null
echo "팀원 8명 추가 완료"

# 2. 커스텀 메뉴 추가
echo ""
echo "2. 커스텀 메뉴 추가 중..."
# 커피
curl -s -X POST "$BASE_URL/menus" -H "Content-Type: application/json" -d '{"name": "아메리카노", "category": "커피"}' > /dev/null
curl -s -X POST "$BASE_URL/menus" -H "Content-Type: application/json" -d '{"name": "카페라떼", "category": "커피"}' > /dev/null
curl -s -X POST "$BASE_URL/menus" -H "Content-Type: application/json" -d '{"name": "바닐라라떼", "category": "커피"}' > /dev/null
curl -s -X POST "$BASE_URL/menus" -H "Content-Type: application/json" -d '{"name": "카라멜마끼아또", "category": "커피"}' > /dev/null
curl -s -X POST "$BASE_URL/menus" -H "Content-Type: application/json" -d '{"name": "카푸치노", "category": "커피"}' > /dev/null
# 디카페인
curl -s -X POST "$BASE_URL/menus" -H "Content-Type: application/json" -d '{"name": "디카페인 아메리카노", "category": "디카페인"}' > /dev/null
curl -s -X POST "$BASE_URL/menus" -H "Content-Type: application/json" -d '{"name": "디카페인 라떼", "category": "디카페인"}' > /dev/null
# 음료
curl -s -X POST "$BASE_URL/menus" -H "Content-Type: application/json" -d '{"name": "초코라떼", "category": "음료"}' > /dev/null
curl -s -X POST "$BASE_URL/menus" -H "Content-Type: application/json" -d '{"name": "녹차라떼", "category": "음료"}' > /dev/null
curl -s -X POST "$BASE_URL/menus" -H "Content-Type: application/json" -d '{"name": "고구마라떼", "category": "음료"}' > /dev/null
curl -s -X POST "$BASE_URL/menus" -H "Content-Type: application/json" -d '{"name": "딸기스무디", "category": "음료"}' > /dev/null
# 티
curl -s -X POST "$BASE_URL/menus" -H "Content-Type: application/json" -d '{"name": "얼그레이", "category": "티"}' > /dev/null
curl -s -X POST "$BASE_URL/menus" -H "Content-Type: application/json" -d '{"name": "캐모마일", "category": "티"}' > /dev/null
curl -s -X POST "$BASE_URL/menus" -H "Content-Type: application/json" -d '{"name": "페퍼민트", "category": "티"}' > /dev/null
curl -s -X POST "$BASE_URL/menus" -H "Content-Type: application/json" -d '{"name": "유자차", "category": "티"}' > /dev/null
echo "메뉴 15개 추가 완료"

# 팀원 ID와 메뉴 ID 조회
echo ""
echo "3. 팀원 및 메뉴 ID 조회 중..."
TEAMS=$(curl -s "$BASE_URL/teams")
MENUS=$(curl -s "$BASE_URL/menus")

# jq가 없으면 수동으로 ID 입력 필요
if command -v jq &> /dev/null; then
    # 팀원 ID 추출
    TEAM_KIMCS=$(echo $TEAMS | jq -r '.[] | select(.name=="김철수") | .id')
    TEAM_LEEYH=$(echo $TEAMS | jq -r '.[] | select(.name=="이영희") | .id')
    TEAM_PARKJM=$(echo $TEAMS | jq -r '.[] | select(.name=="박지민") | .id')
    TEAM_CHOISH=$(echo $TEAMS | jq -r '.[] | select(.name=="최수현") | .id')
    TEAM_JUNGMS=$(echo $TEAMS | jq -r '.[] | select(.name=="정민수") | .id')
    TEAM_KANGYR=$(echo $TEAMS | jq -r '.[] | select(.name=="강예린") | .id')
    TEAM_YOONSJ=$(echo $TEAMS | jq -r '.[] | select(.name=="윤서준") | .id')
    TEAM_HANJW=$(echo $TEAMS | jq -r '.[] | select(.name=="한지우") | .id')

    # 메뉴 ID 추출 (flat list로 변환 후 검색)
    MENU_AMERICANO=$(echo $MENUS | jq -r '.. | objects | select(.name=="아메리카노") | .id' | head -1)
    MENU_LATTE=$(echo $MENUS | jq -r '.. | objects | select(.name=="카페라떼") | .id' | head -1)
    MENU_VANILLA=$(echo $MENUS | jq -r '.. | objects | select(.name=="바닐라라떼") | .id' | head -1)
    MENU_CARAMEL=$(echo $MENUS | jq -r '.. | objects | select(.name=="카라멜마끼아또") | .id' | head -1)
    MENU_DECAF_LATTE=$(echo $MENUS | jq -r '.. | objects | select(.name=="디카페인 라떼") | .id' | head -1)
    MENU_CHOCO=$(echo $MENUS | jq -r '.. | objects | select(.name=="초코라떼") | .id' | head -1)
    MENU_GREEN=$(echo $MENUS | jq -r '.. | objects | select(.name=="녹차라떼") | .id' | head -1)
    MENU_EARL=$(echo $MENUS | jq -r '.. | objects | select(.name=="얼그레이") | .id' | head -1)
    MENU_CAPPUCCINO=$(echo $MENUS | jq -r '.. | objects | select(.name=="카푸치노") | .id' | head -1)
    MENU_STRAWBERRY=$(echo $MENUS | jq -r '.. | objects | select(.name=="딸기스무디") | .id' | head -1)

    echo "팀원 ID: 김철수=$TEAM_KIMCS, 이영희=$TEAM_LEEYH, 박지민=$TEAM_PARKJM"
    echo "메뉴 ID: 아메리카노=$MENU_AMERICANO, 카페라떼=$MENU_LATTE"

    # 4. 과거 주문 추가 (어제 날짜)
    echo ""
    echo "4. 과거 주문 데이터 추가 중..."
    YESTERDAY=$(date -v-1d +%Y-%m-%d 2>/dev/null || date -d "yesterday" +%Y-%m-%d)
    TWO_DAYS_AGO=$(date -v-2d +%Y-%m-%d 2>/dev/null || date -d "2 days ago" +%Y-%m-%d)
    THREE_DAYS_AGO=$(date -v-3d +%Y-%m-%d 2>/dev/null || date -d "3 days ago" +%Y-%m-%d)

    echo "어제 날짜: $YESTERDAY"
    echo "2일 전: $TWO_DAYS_AGO"
    echo "3일 전: $THREE_DAYS_AGO"

    # 3일 전 주문 (커스텀)
    curl -s -X POST "$BASE_URL/orders" -H "Content-Type: application/json" \
        -d "{\"teamId\": $TEAM_KIMCS, \"menuId\": $MENU_AMERICANO, \"menuType\": \"CUSTOM\", \"personalOption\": \"아이스, 샷 추가\", \"orderDate\": \"$THREE_DAYS_AGO\"}" > /dev/null
    curl -s -X POST "$BASE_URL/orders" -H "Content-Type: application/json" \
        -d "{\"teamId\": $TEAM_LEEYH, \"menuId\": $MENU_LATTE, \"menuType\": \"CUSTOM\", \"personalOption\": \"핫\", \"orderDate\": \"$THREE_DAYS_AGO\"}" > /dev/null

    # 2일 전 주문 (커스텀)
    curl -s -X POST "$BASE_URL/orders" -H "Content-Type: application/json" \
        -d "{\"teamId\": $TEAM_KIMCS, \"menuId\": $MENU_AMERICANO, \"menuType\": \"CUSTOM\", \"personalOption\": \"아이스\", \"orderDate\": \"$TWO_DAYS_AGO\"}" > /dev/null
    curl -s -X POST "$BASE_URL/orders" -H "Content-Type: application/json" \
        -d "{\"teamId\": $TEAM_CHOISH, \"menuId\": $MENU_CARAMEL, \"menuType\": \"CUSTOM\", \"personalOption\": \"핫, 시럽 추가\", \"orderDate\": \"$TWO_DAYS_AGO\"}" > /dev/null
    curl -s -X POST "$BASE_URL/orders" -H "Content-Type: application/json" \
        -d "{\"teamId\": $TEAM_JUNGMS, \"menuId\": $MENU_CHOCO, \"menuType\": \"CUSTOM\", \"personalOption\": null, \"orderDate\": \"$TWO_DAYS_AGO\"}" > /dev/null

    # 어제 주문 (커스텀)
    curl -s -X POST "$BASE_URL/orders" -H "Content-Type: application/json" \
        -d "{\"teamId\": $TEAM_KIMCS, \"menuId\": $MENU_AMERICANO, \"menuType\": \"CUSTOM\", \"personalOption\": \"아이스, 연하게\", \"orderDate\": \"$YESTERDAY\"}" > /dev/null
    curl -s -X POST "$BASE_URL/orders" -H "Content-Type: application/json" \
        -d "{\"teamId\": $TEAM_LEEYH, \"menuId\": $MENU_DECAF_LATTE, \"menuType\": \"CUSTOM\", \"personalOption\": \"핫\", \"orderDate\": \"$YESTERDAY\"}" > /dev/null
    curl -s -X POST "$BASE_URL/orders" -H "Content-Type: application/json" \
        -d "{\"teamId\": $TEAM_PARKJM, \"menuId\": $MENU_VANILLA, \"menuType\": \"CUSTOM\", \"personalOption\": \"아이스\", \"orderDate\": \"$YESTERDAY\"}" > /dev/null
    curl -s -X POST "$BASE_URL/orders" -H "Content-Type: application/json" \
        -d "{\"teamId\": $TEAM_CHOISH, \"menuId\": $MENU_EARL, \"menuType\": \"CUSTOM\", \"personalOption\": \"핫\", \"orderDate\": \"$YESTERDAY\"}" > /dev/null
    curl -s -X POST "$BASE_URL/orders" -H "Content-Type: application/json" \
        -d "{\"teamId\": $TEAM_YOONSJ, \"menuId\": $MENU_CAPPUCCINO, \"menuType\": \"CUSTOM\", \"personalOption\": null, \"orderDate\": \"$YESTERDAY\"}" > /dev/null
    curl -s -X POST "$BASE_URL/orders" -H "Content-Type: application/json" \
        -d "{\"teamId\": $TEAM_HANJW, \"menuId\": $MENU_STRAWBERRY, \"menuType\": \"CUSTOM\", \"personalOption\": \"아이스\", \"orderDate\": \"$YESTERDAY\"}" > /dev/null

    echo "과거 주문 11건 추가 완료"
else
    echo "jq가 설치되어 있지 않습니다. 주문 데이터는 수동으로 추가해주세요."
    echo "팀원 목록: $TEAMS"
fi

echo ""
echo "=== 테스트 데이터 추가 완료 ==="
echo ""
echo "확인 방법:"
echo "  - 팀원: curl $BASE_URL/teams"
echo "  - 메뉴: curl $BASE_URL/menus"
echo "  - 오늘 주문: curl $BASE_URL/orders/today"
echo "  - H2 콘솔: http://localhost:8080/h2-console"
