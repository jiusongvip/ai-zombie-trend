/**
 * Example wall for the AI zombie trend landing — frames from the four-shot
 * zombie love story pipeline. Covers are rendered placeholders; each entry
 * keeps a display prompt (inspiration copy) and the tag its story maps to
 * in the homepage generator.
 */

export type ShowcaseTag = 'couple' | 'pet' | 'friend' | 'family';

export interface ShowcaseItem {
  id: string;
  /** Catalog id from `src/config/video-models.ts`, shown on the card badge. */
  modelId: string;
  /** Display label shown on the card. */
  model: string;
  aspect: '16:9' | '9:16';
  /** Feed filter bucket — label comes from `landing.usecases.<tag>.title`. */
  tag: ShowcaseTag;
  cover: string;
  /** Optional generated clip; rendered muted+looping when set. */
  video?: string;
  prompt: { en: string; zh: string };
}

export const showcaseItems: ShowcaseItem[] = [
  {
    id: 'zombie-couple-film',
    modelId: 'bytedance/seedance-2.0/image-to-video',
    model: 'Seedance 2',
    aspect: '9:16',
    tag: 'couple',
    cover: '/images/showcase/zombie-couple-film.webp',
    video: '/videos/showcase/zombie-couple-film.mp4',
    prompt: {
      en: 'A finished four-shot film from two photos: the survivor aims a trembling handgun through the dark cabin, cannot fire, opens both arms — and the zombie’s leap match-cuts into an embrace in a golden wheat field at sunset',
      zh: '两张照片跑出的完整四镜头成片：幸存者在昏暗木屋里颤抖举枪、终究没能扣下扳机、张开双臂——丧尸的那记扑跃经匹配剪辑，化作落日麦田里的拥抱',
    },
  },
  {
    id: 'zombie-couple-film-live',
    modelId: 'sd-2-vip-480',
    model: 'Seedance 2 VIP',
    aspect: '9:16',
    tag: 'couple',
    cover: '/images/showcase/zombie-cabin.webp',
    video: 'https://pub-e275f7eb14794b92b2c9b22fca2b0834.r2.dev/uploads/hfsy/video/79cf471c-1260-4692-9228-fd3c10ff27f8.mp4',
    prompt: {
      en: 'A real couple film generated live on the homepage: two uploaded photos become the survivor and their zombified partner, running the full four-shot story from the dark cabin to the sunset wheat-field embrace',
      zh: '在首页实跑生成的情侣成片：两张上传照片化身幸存者与其丧尸化的爱人，完整跑通从昏暗木屋到落日麦田相拥的四镜头故事',
    },
  },
  {
    id: 'zombie-pet-film',
    modelId: 'bytedance/seedance-2.0/image-to-video',
    model: 'Seedance 2',
    aspect: '9:16',
    tag: 'pet',
    cover: '/images/showcase/zombie-pet-film.webp',
    video: '/videos/showcase/zombie-pet-film.mp4',
    prompt: {
      en: 'The pet version, rendered end to end: the owner lowers the gun and kneels with both arms open, the zombified dog sprints and leaps, and the hard cut returns them both to a sunlit wheat field with the dog healthy again',
      zh: '宠物版完整成片：主人放下枪、跪地张开双臂，丧尸化的狗加速扑跃，硬切之后两人回到阳光下的麦田，狗已恢复健康',
    },
  },
  {
    id: 'zombie-cabin',
    modelId: 'fal-ai/veo3.1',
    model: 'Veo 3.1',
    aspect: '9:16',
    tag: 'couple',
    cover: '/images/showcase/zombie-cabin.webp',
    prompt: {
      en: 'The Cabin, shot one of four: a survivor aims a trembling handgun at the zombified partner they love, tears streaming, dim daylight through the broken cabin windows, cold blue-grey cinematic 3D',
      zh: '四个分镜的第一幕「木屋」：幸存者颤抖着用枪指着已变成丧尸的爱人，泪水滑落，微弱的日光透进破旧的木窗，冷青灰色调电影感 3D 画面',
    },
  },
  {
    id: 'zombie-reunion',
    modelId: 'fal-ai/veo3.1',
    model: 'Veo 3.1',
    aspect: '9:16',
    tag: 'couple',
    cover: '/images/showcase/zombie-reunion.webp',
    prompt: {
      en: 'The Match Cut, shot four of four: mid-air the dark cabin becomes a golden wheat field at sunset, the zombie leap landing as a tight embrace with both characters alive again, warm cinematic 3D',
      zh: '匹配剪辑，第四幕：腾空瞬间昏暗木屋化作落日下的金色麦田，丧尸的扑跃落成一次紧拥，两人恢复人样，温暖电影感 3D',
    },
  },
  {
    id: 'zombie-memory',
    modelId: 'fal-ai/veo3.1',
    model: 'Veo 3.1',
    aspect: '9:16',
    tag: 'couple',
    cover: '/images/showcase/zombie-memory.webp',
    prompt: {
      en: 'The Choice, shot three of four: still crying, the survivor lowers the handgun and lets it fall, then spreads both arms wide in painful acceptance, inviting the zombie into an embrace',
      zh: '抉择，第三幕：幸存者仍在落泪，却缓缓垂下手枪任其跌落，随即张开双臂——以痛苦的接纳向丧尸发出拥抱的邀请',
    },
  },
  {
    id: 'zombie-pet-dog',
    modelId: 'fal-ai/veo3.1',
    model: 'Veo 3.1',
    aspect: '9:16',
    tag: 'pet',
    cover: '/images/showcase/zombie-pet-dog.webp',
    prompt: {
      en: 'Zombie pet version, four shots: the owner lowers the gun and opens their arms, the zombified dog sprints and leaps, and the hard cut lands them both in a golden wheat field with the dog healthy again',
      zh: '丧尸宠物版四镜头：主人放下枪张开双臂，丧尸化的狗加速扑跃，硬切之后两者都落在金色麦田里，狗已恢复健康',
    },
  },
  {
    id: 'zombie-friends',
    modelId: 'fal-ai/veo3.1',
    model: 'Veo 3.1',
    aspect: '9:16',
    tag: 'friend',
    cover: '/images/showcase/zombie-friends.webp',
    prompt: {
      en: 'Zombie friends version, four shots: one friend cannot pull the trigger, drops the gun and opens both arms; the other sprints, leaps, and the match cut turns the tackle into a hug in a wheat field at sunset',
      zh: '丧尸好友版四镜头：一位好友终究无法扣下扳机，放下枪、张开双臂；另一位的扑跃经匹配剪辑，在落日麦田里化作一个拥抱',
    },
  },
  {
    id: 'zombie-family',
    modelId: 'fal-ai/veo3.1',
    model: 'Veo 3.1',
    aspect: '9:16',
    tag: 'family',
    cover: '/images/showcase/zombie-family.webp',
    prompt: {
      en: 'Family version, four shots: the grown child cannot fire on the zombified parent they were raised by, drops the gun and opens both arms; the leap match-cuts into a tight embrace under a golden sunset',
      zh: '亲情版四镜头：幸存的子女对着已丧尸化的至亲终究没能扣下扳机，放下枪、张开双臂；那一扑经匹配剪辑，在金色落日下化作一个紧拥',
    },
  },
];
