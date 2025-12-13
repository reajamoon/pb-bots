import Discord from 'discord.js';
const { MessageFlags, ButtonBuilder, ButtonStyle, ActionRowBuilder } = Discord;
import { User } from '../../../../models/index.js';
import maybeTriggerProfileSetupComplete from '../../../../shared/hunts/checkProfileSetup.js';
import { updateOriginalProfile } from '../../utils/updateOriginalProfile.js';
import { parseButtonId } from '../../../../shared/utils/buttonId.js';

export async function handleClearers(interaction) {
  const customId = interaction.customId || '';
  const parsed = parseButtonId(customId);
  const originalMessageId = parsed?.secondaryId && /^\d{17,19}$/.test(parsed.secondaryId) ? parsed.secondaryId : null;
  const userId = interaction.user.id;

  const buildBackButton = (msgId = originalMessageId) => new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(msgId ? `profile_settings_${userId}_${msgId}` : `profile_settings_${userId}`)
      .setLabel('← Back to Profile Settings')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('⚙️')
  );

  try {
    if (customId.includes('clear_bio')) {
      await User.update({ bio: null }, { where: { discordId: userId } });
      await interaction.update({ content: '🗑️ Bio cleared.', components: [buildBackButton()], embeds: [] });
    } else if (customId.includes('clear_timezone')) {
      await User.update({ timezone: null }, { where: { discordId: userId } });
      await interaction.update({ content: '🗑️ Timezone cleared.', components: [buildBackButton()], embeds: [] });
    } else if (customId.includes('clear_region')) {
      await User.update({ region: null }, { where: { discordId: userId } });
      await interaction.update({ content: '🗑️ Region cleared.', components: [buildBackButton()], embeds: [] });
    } else if (customId.includes('clear_birthday')) {
      await User.update({ birthday: null, birthdayYearHidden: false, birthdayAgePrivacy: false }, { where: { discordId: userId } });
      await interaction.update({ content: '🗑️ Birthday cleared.', components: [buildBackButton()], embeds: [] });
    } else {
      return; // not a clearer action
    }

    // Dual update original profile if tracked
    if (originalMessageId) {
      await updateOriginalProfile(interaction, originalMessageId, 'profile clear');
    }

    // Check Hunt setup completion (may not trigger if clearing drops below threshold)
    await maybeTriggerProfileSetupComplete(userId, { interaction });
  } catch (error) {
    await interaction.update({ content: '❌ Something went wrong. Please try again.', components: [buildBackButton()], embeds: [] });
  }
}
