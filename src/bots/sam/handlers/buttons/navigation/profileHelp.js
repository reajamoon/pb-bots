import Discord from 'discord.js';
import { parseButtonId } from '../../../../../shared/utils/buttonId.js';

async function getHelpMenuPayload(customId) {
    const parsed = parseButtonId(customId);
    if (!parsed || parsed.context !== 'profile_help_menu') return null;

    const ephemeralFlag = Discord.MessageFlags?.Ephemeral ?? 64;

    const mockInteraction = {
        user: { id: parsed.primaryId },
        id: parsed.secondaryId,
        message: { id: parsed.secondaryId }
    };

    switch (parsed.action) {
        case 'birthday': {
            const { createBirthdayHelp } = await import('../../../utils/profileHelpBirthday.js');
            const { embed, components } = await createBirthdayHelp(mockInteraction);
            return { type: 'back', embeds: [embed], components, flags: ephemeralFlag };
        }
        case 'bio': {
            const { createBioHelp } = await import('../../../utils/profileHelpBio.js');
            const { embed, components } = await createBioHelp(mockInteraction);
            return { type: 'back', embeds: [embed], components, flags: ephemeralFlag };
        }
        case 'timezone_region': {
            const { createTimezoneRegionHelp } = await import('../../../utils/profileHelpTimezoneRegion.js');
            const { embed, components } = await createTimezoneRegionHelp(mockInteraction);
            return { type: 'back', embeds: [embed], components, flags: ephemeralFlag };
        }
        case 'privacy': {
            const { createPrivacyHelp } = await import('../../../utils/profileHelpPrivacy.js');
            const { embed, components } = await createPrivacyHelp(mockInteraction);
            return { type: 'back', embeds: [embed], components, flags: ephemeralFlag };
        }
        case 'tips': {
            const { createTipsHelp } = await import('../../../utils/profileHelpTips.js');
            const { embed, components } = await createTipsHelp(mockInteraction);
            return { type: 'back', embeds: [embed], components, flags: ephemeralFlag };
        }
        case 'main': {
            const { createProfileHelpMain } = await import('../../../utils/profileHelp.js');
            const { embed, components } = await createProfileHelpMain(mockInteraction);
            return { type: 'back', embeds: [embed], components, flags: ephemeralFlag };
        }
        case 'done':
            return { type: 'close', content: '❌ Help closed.', components: [], embeds: [], flags: ephemeralFlag, userId: parsed.primaryId, messageId: parsed.secondaryId };
        default:
            return null;
    }
}

export { getHelpMenuPayload };
