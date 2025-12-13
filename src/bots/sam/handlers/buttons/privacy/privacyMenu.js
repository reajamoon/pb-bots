
import Discord from 'discord.js';
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = Discord;
import { buildButtonId } from '../../../../../shared/utils/buttonId.js';
import { buildPrivacySettingsDoneCustomId, encodeMessageId } from '../../../../../shared/utils/messageTracking.js';
import logger from '../../../../../shared/utils/logger.js';

async function buildPrivacySettingsButtonId(action, userId, messageId) {
    return await buildButtonId({
        action,
        context: 'privacy_settings',
        primaryId: userId,
        secondaryId: messageId
    });
}

async function buildPrivacySettingsDoneButtonId(userId, messageId) {
    return await buildButtonId({
        action: 'done',
        context: 'privacy_settings',
        primaryId: userId,
        secondaryId: messageId
    });
}

export async function buildPrivacySettingsMenu(userData, userId, messageId = null, validatedMessageId = null, interaction = null) {
    const menuTextsAll = (await import('../../../../../shared/text/menuTexts.json', { with: { type: 'json' } })).default;
    const menuTexts = menuTextsAll.privacy;
    const mentionsEnabled = userData.birthdayMentions !== false;
    const announcementsEnabled = userData.birthdayAnnouncements !== false;
    const privacyModeFull = userData.birthdayPrivacyFull === true;
    const privacyModeAgeHidden = userData.birthdayAgeOnly === true;
    const birthdayHidden = userData.birthdayHidden === true;
    // Strict = birthday stored without a real year (1900 placeholder)
    const birthYear = userData.birthday ? parseInt(String(userData.birthday).split('-')[0], 10) : null;
    const hasRealBirthYear = Number.isFinite(birthYear) && birthYear >= 1920 && birthYear <= new Date().getFullYear();
    const isPrivacyModeStrict = userData.birthdayYearHidden === true && birthYear === 1900;
    const privacyModeYearHidden = userData.birthdayYearHidden === true && hasRealBirthYear;

    // Prefer validatedMessageId; if none is available, run untracked (menu still works, but no dual update)
    const effectiveMsgId = validatedMessageId || messageId;
    const hasTrackedMessageId = effectiveMsgId && /^\d{17,19}$/.test(effectiveMsgId);
    if (!hasTrackedMessageId) {
        logger.warn('[PrivacyMenu] Building untracked privacy menu (no original profile message ID)', { validatedMessageId, messageId });
    }
    const encodedMsgId = hasTrackedMessageId ? encodeMessageId(effectiveMsgId) : null;
    const row1 = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(await buildPrivacySettingsButtonId('toggle_birthday_mentions', userId, encodedMsgId))
                .setLabel(mentionsEnabled ? menuTexts.birthdayMentionsOn : menuTexts.birthdayMentionsOff)
                .setStyle(mentionsEnabled ? ButtonStyle.Success : ButtonStyle.Secondary)
                .setEmoji('🎉'),
            new ButtonBuilder()
                .setCustomId(await buildPrivacySettingsButtonId('toggle_birthday_lists', userId, encodedMsgId))
                .setLabel(announcementsEnabled ? menuTexts.dailyListsOn : menuTexts.dailyListsOff)
                .setStyle(announcementsEnabled ? ButtonStyle.Success : ButtonStyle.Secondary)
                .setEmoji('📋')
        );

    const privacyFullButton = new ButtonBuilder()
        .setCustomId(await buildPrivacySettingsButtonId('toggle_privacy_mode_full', userId, encodedMsgId))
        .setLabel(privacyModeFull ? menuTexts.privacyModeFullOn : menuTexts.privacyModeFullOff)
        .setStyle(privacyModeFull ? ButtonStyle.Success : ButtonStyle.Secondary)
        .setEmoji('🔒');
    // Full privacy does not require a birth year, so it stays toggleable even in strict mode.

    const privacyAgeHiddenButton = new ButtonBuilder()
        .setCustomId(await buildPrivacySettingsButtonId('toggle_privacy_mode_age_hidden', userId, encodedMsgId))
        .setLabel(privacyModeAgeHidden ? menuTexts.privacyModeAgeHiddenOn : menuTexts.privacyModeAgeHiddenOff)
        .setStyle(privacyModeAgeHidden ? ButtonStyle.Success : ButtonStyle.Secondary)
        .setEmoji('🎭');
    // Age-hidden is effectively locked in strict mode (no year -> no age).
    if (isPrivacyModeStrict) privacyAgeHiddenButton.setDisabled(true);

    const privacyYearHiddenButton = new ButtonBuilder()
        .setCustomId(await buildPrivacySettingsButtonId('toggle_privacy_mode_year_hidden', userId, encodedMsgId))
        .setLabel(privacyModeYearHidden ? menuTexts.privacyModeYearHiddenOn : menuTexts.privacyModeYearHiddenOff)
        .setStyle(privacyModeYearHidden ? ButtonStyle.Success : ButtonStyle.Secondary)
        .setEmoji('📅');
    // Only makes sense when a real birth year exists. In strict mode, it's already effectively on.
    if (!hasRealBirthYear || isPrivacyModeStrict) privacyYearHiddenButton.setDisabled(true);

    const row2 = new ActionRowBuilder()
        .addComponents(
            privacyFullButton,
            privacyAgeHiddenButton,
            privacyYearHiddenButton
        );

    const row3 = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(await buildPrivacySettingsButtonId('toggle_birthday_hidden', userId, encodedMsgId))
                .setLabel(birthdayHidden ? menuTexts.profileBirthdayHidden : menuTexts.profileBirthdayVisible)
                .setStyle(birthdayHidden ? ButtonStyle.Danger : ButtonStyle.Secondary)
                .setEmoji('👻'),
            new ButtonBuilder()
                .setCustomId(await buildPrivacySettingsDoneButtonId(userId, encodedMsgId))
                .setLabel(menuTexts.closeSettings)
                .setStyle(ButtonStyle.Primary)
                .setEmoji('✅')
        );

    // Minimal embed for message tracking and dual update validation
    const embed = {
        title: 'Privacy Settings',
        description: 'Manage your profile birthday and privacy settings.',
        fields: [
            { name: 'User ID', value: userId },
            { name: 'Birthday Hidden', value: String(userData.birthdayHidden ?? false) }
        ]
    };
    return { components: [row1, row2, row3], embeds: [embed] };
}
