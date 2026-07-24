package com.leadpot.common.upload;

import java.net.URI;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.S3Configuration;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;

/**
 * Cloudflare R2 저장(S3 호환). app.storage.type=r2 일 때 활성화.
 * 필요한 환경변수: APP_STORAGE_R2_ENDPOINT / ACCESS_KEY / SECRET_KEY / BUCKET / PUBLIC_BASE_URL
 */
@Component
@ConditionalOnProperty(prefix = "app.storage", name = "type", havingValue = "r2")
public class R2FileStorage implements FileStorage {

    private final S3Client s3;
    private final String bucket;
    private final String publicBaseUrl;

    public R2FileStorage(
            @Value("${app.storage.r2.endpoint}") String endpoint,
            @Value("${app.storage.r2.access-key}") String accessKey,
            @Value("${app.storage.r2.secret-key}") String secretKey,
            @Value("${app.storage.r2.bucket}") String bucket,
            @Value("${app.storage.r2.public-base-url}") String publicBaseUrl) {
        this.bucket = bucket;
        this.publicBaseUrl = publicBaseUrl.endsWith("/")
                ? publicBaseUrl.substring(0, publicBaseUrl.length() - 1)
                : publicBaseUrl;
        this.s3 = S3Client.builder()
                .endpointOverride(URI.create(endpoint))
                .region(Region.of("auto")) // R2는 region "auto"
                .credentialsProvider(StaticCredentialsProvider.create(AwsBasicCredentials.create(accessKey, secretKey)))
                .serviceConfiguration(S3Configuration.builder().pathStyleAccessEnabled(true).build())
                .build();
    }

    @Override
    public String store(String filename, byte[] content, String contentType) {
        s3.putObject(
                PutObjectRequest.builder().bucket(bucket).key(filename).contentType(contentType).build(),
                RequestBody.fromBytes(content));
        return publicBaseUrl + "/" + filename;
    }
}
