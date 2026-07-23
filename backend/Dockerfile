# 멀티스테이지 빌드: 컨테이너 안에서 빌드+실행 → 호스트에 JDK 없어도 됨
# 1) 빌드 스테이지 (JDK 21로 bootJar 생성)
FROM eclipse-temurin:21-jdk AS build
WORKDIR /app
COPY gradlew settings.gradle build.gradle ./
COPY gradle ./gradle
# 의존성 캐시 레이어 (소스 변경 시 재다운로드 최소화)
RUN chmod +x gradlew && ./gradlew dependencies --no-daemon || true
COPY src ./src
RUN ./gradlew bootJar -x test --no-daemon

# 2) 실행 스테이지 (가벼운 JRE 21)
FROM eclipse-temurin:21-jre
WORKDIR /app
COPY --from=build /app/build/libs/*.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
