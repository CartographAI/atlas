import { google } from "@ai-sdk/google";
import { generateObject, type CoreMessage } from "ai";
import { z } from "zod";

export async function generateGeminiObject<T extends z.ZodTypeAny>(
  messages: Array<CoreMessage>,
  responseModel: T,
): Promise<z.infer<T> | null> {
  const result = await generateObject({
    model: google("gemini-2.0-flash-001"),
    messages: messages,
    schema: responseModel,
  });
  return responseModel.parse(result.object);
}
