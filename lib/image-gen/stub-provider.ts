/**
 * Стаб провайдера картинок — без KIE до включения IMAGE_GENERATION_ENABLED.
 */
import { prisma } from '@/lib/db';
import { buildImagePrompt } from '@/lib/content/prompts';
import type { ImageGenProvider, ImageGenRequest, ImageGenResult } from './types';

class StubImageProvider implements ImageGenProvider {
  readonly name = 'stub';

  isEnabled(): boolean {
    return process.env.IMAGE_GENERATION_ENABLED === 'true' && Boolean(process.env.KIE_API_KEY?.trim());
  }

  async generate(req: ImageGenRequest): Promise<ImageGenResult> {
    if (!this.isEnabled()) {
      return { ok: false, error: 'image_generation_disabled', provider: this.name };
    }
    // KIE интеграция — отложена; при включении флага вернуть заглушку до реализации клиента.
    return { ok: false, error: 'kie_not_implemented', provider: this.name };
  }
}

const provider = new StubImageProvider();

export async function generateImageForItem(itemId: string): Promise<ImageGenResult> {
  const item = await prisma.contentItem.findUnique({ where: { id: itemId } });
  if (!item) return { ok: false, error: 'not_found', provider: provider.name };

  const prompt = buildImagePrompt({
    postType: item.postType,
    topic: item.topic,
    objective: item.objective ?? '',
    outline: item.outline ?? '',
    cta: item.cta ?? '',
  });

  const result = await provider.generate({ itemId, postType: item.postType, topic: item.topic, prompt });
  if (result.ok && result.imageUrl) {
    await prisma.contentItem.update({ where: { id: itemId }, data: { imageUrl: result.imageUrl } });
  }
  return result;
}

export { StubImageProvider };
