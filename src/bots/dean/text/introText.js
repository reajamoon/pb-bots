export function deanIntroMessage(memberMention, modQuestionsChannelMention, casMention) {
  const modQuestionsRef = modQuestionsChannelMention || 'the mod-questions channel';
  const casRef = casMention || 'Cas';

  return `Hey ${memberMention}, glad you made it. Welcome to Profound Bond, we’re Discord’s HQ for 18+ Destiel fans. Since you’re here, you’ve already been through onboarding. If you want more roles and channels, open Channels & Roles at the top of the sidebar. If you have questions, drop them in ${modQuestionsRef} or DM ${casRef} to send a ModMail. Anyway, share a few lines about yourself so we can get to know you. It doesn’t need to follow a template. If you like prompts, use /intro and I’ll walk you through a few.`;
}

export default deanIntroMessage;