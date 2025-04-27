import fs from "fs";
import os from "os";
import path from "path";
import sharp, { type AvailableFormatInfo, type FormatEnum } from "sharp";

const IMAGE_DESCRIPTION_PROMPT = "Describe this image and give it a title. The first line should be the title, and then a line break, then a detailed description of the image. Respond with the format 'title\\ndescription'";

const convertToBase64DataUrl = (imageData: Buffer, mimeType: string): string => {
    const base64Data = imageData.toString("base64");
    return `data:${mimeType};base64,${base64Data}`;
};
const handleApiError = async (response: Response, provider: string): Promise<never> => {
    const responseText = await response.text();
    console.error(`${provider} API error:`, response.status, "-", responseText);
    throw new Error(`HTTP error! status: ${response.status}`);
};
const parseImageResponse = (text: string): { title: string; description: string } => {
    const [title, ...descriptionParts] = text.split("\n");
    return { title, description: descriptionParts.join("\n") };
};
export class OpenAIImageProvider {
    async describeImage(imageData: Buffer, mimeType: string): Promise<{ title: string; description: string }> {
        const imageUrl = convertToBase64DataUrl(imageData, mimeType);

        const content = [
            { type: "text", text: IMAGE_DESCRIPTION_PROMPT },
            { type: "image_url", image_url: { url: imageUrl } },
        ];

        const endpoint = "https://api.openai.com/v1";

        const response = await fetch(endpoint + "/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${process.env.OPENAI_API_KEY_IMAGE}`,
            },
            body: JSON.stringify({
                model: "gpt-4o-mini",
                messages: [{ role: "user", content }],
                max_tokens: 500,
            }),
        });

        if (!response.ok) {
            await handleApiError(response, "OpenAI");
        }

        const data = await response.json();
        return parseImageResponse(data.choices[0].message.content);
    }

}

export class ImageDescriptionService {
    async describeImage(imageUrlOrPath: string): Promise<{ title: string; description: string }> {
        try {
            const { data, mimeType } = await this.loadImageData(imageUrlOrPath);
            const provider = new OpenAIImageProvider();
            return await provider.describeImage(data, mimeType);
        } catch (error) {
            console.error("Error in describeImage:", error);
            throw error;
        }
    }
    private async loadImageData(imageUrlOrPath: string): Promise<{ data: Buffer; mimeType: string }> {
        let loadedImageData: Buffer;
        let loadedMimeType: string;
        const { imageData, mimeType } = await this.fetchImage(imageUrlOrPath);
        const skipConversion = mimeType === "image/jpeg" || mimeType === "image/jpg" || mimeType === "image/png";
        if (skipConversion) {
            loadedImageData = imageData;
            loadedMimeType = mimeType;
        } else {
            const converted = await this.convertImageDataToFormat(imageData, "png");
            loadedImageData = converted.imageData;
            loadedMimeType = converted.mimeType;
        }
        if (!loadedImageData || loadedImageData.length === 0) {
            throw new Error("Failed to fetch image data");
        }
        return { data: loadedImageData, mimeType: loadedMimeType };
    }

    private async convertImageDataToFormat(data: Buffer, format: keyof FormatEnum | AvailableFormatInfo = "png"): Promise<{ imageData: Buffer; mimeType: string }> {
        const tempFilePath = path.join(os.tmpdir(), `tmp_img_${Date.now()}.${format}`);
        try {
            await sharp(data).toFormat(format).toFile(tempFilePath);
            const { imageData, mimeType } = await this.fetchImage(tempFilePath);
            return {
                imageData,
                mimeType,
            };
        } finally {
            fs.unlinkSync(tempFilePath); // Clean up temp file
        }
    }

    private async fetchImage(imageUrlOrPath: string): Promise<{ imageData: Buffer; mimeType: string }> {
        let imageData: Buffer;
        let mimeType: string;
        if (fs.existsSync(imageUrlOrPath)) {
            imageData = fs.readFileSync(imageUrlOrPath);
            const ext = path.extname(imageUrlOrPath).slice(1).toLowerCase();
            mimeType = ext ? `image/${ext}` : "image/jpeg";
        } else {
            const response = await fetch(imageUrlOrPath);
            if (!response.ok) {
                throw new Error(`Failed to fetch image: ${response.statusText}`);
            }
            imageData = Buffer.from(await response.arrayBuffer());
            mimeType = response.headers.get("content-type") || "image/jpeg";
        }
        return { imageData, mimeType };
    }
}