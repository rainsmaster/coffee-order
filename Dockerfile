# 멀티 스테이지 빌드
# Stage 1: Build (React + Spring Boot)
FROM maven:3.9-eclipse-temurin-17 AS build
WORKDIR /app

# Node.js 설치 (React 빌드용)
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs

# 전체 프로젝트 복사
COPY pom.xml .
COPY coffee-order-api ./coffee-order-api/
COPY coffee-order-frontweb ./coffee-order-frontweb/

# Maven 빌드 (React 빌드 포함)
# frontend-maven-plugin이 자동으로 React를 빌드하고 static 폴더에 복사
RUN mvn clean package -DskipTests

# Stage 2: Runtime
FROM eclipse-temurin:17-jre-jammy
WORKDIR /app

# 빌드된 JAR 파일 복사 (React 빌드 결과 포함)
COPY --from=build /app/coffee-order-api/target/coffee-order-api-1.0.0.jar app.jar

# 데이터 저장 디렉토리 생성
RUN mkdir -p /app/data

# 포트 노출
EXPOSE 8080

# 애플리케이션 실행
ENTRYPOINT ["java", "-jar", "app.jar"]