/**
 * Типы провайдера генерации изображений.
 */
export type ImageGenRequest = {
  itemId: string;
  postType: string;
  topic: string;
  prompt: string;
};

export type ImageGenResult = {
  ok: boolean;
  imageUrl?: string;
  error?: string;
  provider: string;
};

export interface ImageGenProvider {
  readonly name: string;
  isEnabled(): boolean;
  generate(req: ImageGenRequest): Promise<ImageGenResult>;
}
