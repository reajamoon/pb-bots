import { User } from '../../../models/index.js';
import logger from '../../../shared/utils/logger.js';
import Discord from 'discord.js';
const { MessageFlags, ButtonBuilder, ButtonStyle, ActionRowBuilder } = Discord;
const EPHEMERAL_FLAG = typeof MessageFlags !== 'undefined' && MessageFlags.Ephemeral ? MessageFlags.Ephemeral : 64;
import { getProfileMessageId } from '../../../shared/utils/messageTracking.js';

/**
 * Handle select menu interactions
 */
async function handleSelectMenu(interaction) {
    try {
        if (interaction.customId.startsWith('timezone_display_select')) {
            const selectedOption = interaction.values[0];
            try {
                await User.update(
                    { timezoneDisplay: selectedOption },
                    { where: { discordId: interaction.user.id } }
                );

                const optionNames = {
                    'iana': 'Full Name (e.g., America/New_York)',
                    'offset': 'UTC Offset (e.g., UTC-5)',
                    'short': 'Short Code (e.g., EST, PST)',
                    'combined': 'Combined (e.g., (UTC-08:00) Pacific Time)',
                    'hidden': 'Hidden (timezone won\'t show on profile)'
                };

                // Extract original profile message ID from the select menu custom ID
                const messageIdForButton = getProfileMessageId(interaction, interaction.customId);

                // Create back button to return to Profile Settings with proper message tracking
                const backButton = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId(messageIdForButton ? `profile_settings_${interaction.user.id}_${messageIdForButton}` : `profile_settings_${interaction.user.id}`)
                            .setLabel('← Back to Profile Settings')
                            .setStyle(ButtonStyle.Secondary)
                            .setEmoji('⚙️')
                    );

                await interaction.update({
                    content: `🌍 **Timezone display updated!**\n\n` +
                           `Your timezone will now show as: **${optionNames[selectedOption]}**\n\n` +
                           `✅ Changes will appear in your profile automatically\n` +
                           `✅ Others will see your timezone in the new format\n` +
                           `✅ You can change this anytime in Profile Settings`,
                    components: [backButton]
                });

                // Try to update the original profile message if we can extract the message ID
                const originalMessageId = messageIdForButton;

                // Update the original profile if we found the message ID
                if (originalMessageId) {
                    const mod = await import('../../utils/updateOriginalProfile.js');
                    await mod.updateOriginalProfile(interaction, originalMessageId, 'timezone display change');
                }

                logger.info(`User ${interaction.user.tag} updated timezone display to ${selectedOption}`);
            } catch (error) {
                logger.error(`Error updating timezone display for ${interaction.user.tag}:`, error);
                await interaction.update({
                    content: 'Something went wrong updating your timezone display. Want to try that again?',
                    components: []
                });
            }
        }
        // Test button for development
        else if (interaction.customId === 'test_button_update') {
            try {
                await interaction.update({
                    content: '✅ **Button update test successful!**\n\nButtons can successfully update their own messages.',
                    components: []
                });
            } catch (error) {
                console.error('Error in test button:', error);
            }
        }
        else {
            logger.warn(`Unhandled select menu interaction: ${interaction.customId}`);
            await interaction.reply({
                content: 'This select menu interaction is not currently supported.',
                flags: EPHEMERAL_FLAG
            });
        }

    } catch (error) {
        logger.error('Error in select menu handler:', error);

        try {
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    content: 'Something went wrong processing that selection. Please try again.',
                    flags: EPHEMERAL_FLAG
                });
            }
        } catch (responseError) {
            logger.error('Error responding to failed select menu interaction:', responseError);
        }
    }
}

export { handleSelectMenu };