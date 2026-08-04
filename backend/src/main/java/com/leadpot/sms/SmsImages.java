package com.leadpot.sms;

import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.Iterator;

import javax.imageio.IIOImage;
import javax.imageio.ImageIO;
import javax.imageio.ImageWriteParam;
import javax.imageio.ImageWriter;
import javax.imageio.stream.MemoryCacheImageOutputStream;

import com.leadpot.common.error.InvalidSubmissionException;

/**
 * 솔라피 MMS 이미지 규격에 맞게 변환한다 — <b>JPG · 200KB 이하</b>만 받는다.
 *
 * <p>마케터에게 규격을 지키게 하면(직접 리사이즈) 실사용에서 막힌다. 그래서 PNG·큰 JPG 를 올려도
 * 서버가 JPG 로 바꾸고 200KB 아래로 줄인다. 명함 사진을 그냥 올리면 되게 하는 게 목적이다.
 *
 * <p>줄이는 순서: <b>품질을 먼저 낮추고</b>, 그래도 넘치면 <b>긴 변을 줄인다</b>.
 * 명함은 글자를 읽을 수 있어야 하므로 해상도를 최대한 늦게 포기한다.
 */
public final class SmsImages {

    /** 솔라피 MMS 첨부 상한. */
    public static final int MAX_BYTES = 200 * 1024;
    /** 첫 시도의 긴 변 상한(픽셀). 이보다 큰 원본은 먼저 여기까지 줄인다. */
    private static final int START_EDGE = 1500;
    /** 더 줄여도 의미가 없는 하한. 여기서도 200KB 를 못 맞추면 포기한다. */
    private static final int MIN_EDGE = 480;
    private static final float[] QUALITY_STEPS = {0.85f, 0.7f, 0.55f, 0.4f};

    private SmsImages() {
    }

    /**
     * 규격에 맞출 수 없을 때. 사유를 그대로 화면에 보여주기 위한 예외다.
     * 공통 핸들러가 400 으로 내려주도록 {@link InvalidSubmissionException} 을 상속한다.
     */
    public static class UnsupportedImageException extends InvalidSubmissionException {
        public UnsupportedImageException(String message) {
            super(message);
        }
    }

    /**
     * 어떤 이미지든 MMS 규격 JPG(200KB 이하)로 변환한다.
     *
     * @throws UnsupportedImageException 이미지로 읽을 수 없거나, 최소 크기까지 줄여도 200KB 를 못 맞출 때
     */
    public static byte[] toMmsJpeg(byte[] source) {
        BufferedImage original = read(source);
        int edge = Math.min(START_EDGE, Math.max(original.getWidth(), original.getHeight()));
        // 원본이 MIN_EDGE 보다 작아도 반드시 한 번은 인코딩한다.
        // (while(edge >= MIN_EDGE) 로 두면 작은 이미지가 루프를 못 돌고 그대로 실패했다)
        while (true) {
            BufferedImage scaled = scaleToEdge(original, edge);
            for (float quality : QUALITY_STEPS) {
                byte[] jpeg = writeJpeg(scaled, quality);
                if (jpeg.length <= MAX_BYTES) {
                    return jpeg;
                }
            }
            if (edge <= MIN_EDGE) {
                break;
            }
            edge = Math.max(MIN_EDGE, edge * 3 / 4);
        }
        throw new UnsupportedImageException(
                "이미지를 200KB 이하로 줄이지 못했습니다. 더 단순한 이미지를 쓰거나 직접 축소해 올려주세요.");
    }

    private static BufferedImage read(byte[] source) {
        if (source == null || source.length == 0) {
            throw new UnsupportedImageException("파일이 비어 있습니다.");
        }
        try {
            BufferedImage img = ImageIO.read(new ByteArrayInputStream(source));
            if (img == null) {
                // SVG·HEIC 등 ImageIO 가 모르는 형식. PDF 명함도 여기로 떨어진다.
                throw new UnsupportedImageException("읽을 수 없는 이미지입니다. JPG 또는 PNG 로 올려주세요.");
            }
            return img;
        } catch (IOException e) {
            throw new UnsupportedImageException("이미지를 읽지 못했습니다: " + e.getMessage());
        }
    }

    /**
     * 긴 변이 {@code edge} 가 되도록 비율을 지켜 축소한다(원본이 더 작으면 그대로).
     * 투명 PNG 는 JPG 에 알파가 없어 검게 변하므로 <b>흰 배경</b>에 올린다.
     */
    private static BufferedImage scaleToEdge(BufferedImage src, int edge) {
        int w = src.getWidth();
        int h = src.getHeight();
        double ratio = (double) edge / Math.max(w, h);
        int tw = ratio < 1 ? (int) Math.round(w * ratio) : w;
        int th = ratio < 1 ? (int) Math.round(h * ratio) : h;

        BufferedImage out = new BufferedImage(Math.max(tw, 1), Math.max(th, 1), BufferedImage.TYPE_INT_RGB);
        Graphics2D g = out.createGraphics();
        try {
            g.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BILINEAR);
            g.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
            g.setColor(Color.WHITE);
            g.fillRect(0, 0, out.getWidth(), out.getHeight());
            g.drawImage(src, 0, 0, out.getWidth(), out.getHeight(), null);
        } finally {
            g.dispose();
        }
        return out;
    }

    private static byte[] writeJpeg(BufferedImage image, float quality) {
        Iterator<ImageWriter> writers = ImageIO.getImageWritersByFormatName("jpg");
        if (!writers.hasNext()) {
            throw new UnsupportedImageException("서버에 JPEG 인코더가 없습니다.");
        }
        ImageWriter writer = writers.next();
        ByteArrayOutputStream buffer = new ByteArrayOutputStream();
        try (MemoryCacheImageOutputStream out = new MemoryCacheImageOutputStream(buffer)) {
            ImageWriteParam param = writer.getDefaultWriteParam();
            param.setCompressionMode(ImageWriteParam.MODE_EXPLICIT);
            param.setCompressionQuality(quality);
            writer.setOutput(out);
            writer.write(null, new IIOImage(image, null, null), param);
        } catch (IOException e) {
            throw new UnsupportedImageException("이미지를 변환하지 못했습니다: " + e.getMessage());
        } finally {
            writer.dispose();
        }
        return buffer.toByteArray();
    }
}
