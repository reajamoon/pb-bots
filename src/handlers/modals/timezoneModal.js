const { MessageFlags } = require('discord.js');
const { User } = require('../../models');
const logger = require('../../utils/logger');

/**
 * Handle timezone modal submission
 * @param {Object} interaction - Discord modal interaction
 * @param {string} originalMessageId - Optional original profile message ID for dual updates
 */
async function handleTimezoneModal(interaction, originalMessageId = null) {
    logger.info(`=== TIMEZONE MODAL START === User: ${interaction.user.tag}, CustomId: ${interaction.customId}`);
    // Extract originalMessageId from customId if not provided
    if (!originalMessageId) {
    const { getProfileMessageId } = require('../../utils/messageTracking');
        originalMessageId = getProfileMessageId(interaction, interaction.customId);
    }
    logger.info(`Timezone Modal: originalMessageId parameter = ${originalMessageId}`);

    const timezoneInput = interaction.fields.getTextInputValue('timezone_input').trim();
    logger.info(`Timezone Modal: timezoneInput = "${timezoneInput}"`);

    if (!timezoneInput) {
        // Create back button to return to Profile Settings
        const { ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
        const backButton = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`profile_settings_${interaction.user.id}`)
                    .setLabel('← Back to Profile Settings')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('⚙️')
            );

        return await interaction.update({
            content: '❌ **Timezone cannot be empty!**\n\nPlease try again with a valid timezone.',
            components: [backButton],
            embeds: []
        });
    }
    if (timezoneInput.length < 2) {
        logger.warn(`[TimezoneModal] Validation error: timezone too short (length=${timezoneInput.length}) for user ${interaction.user.id}`);
        return await interaction.reply({
            content: 'Timezone must be at least 2 characters long. Please enter a valid timezone.',
            flags: MessageFlags.Ephemeral
        });
    }

    // Validate timezone using the new region-based validator
    const { validateTimezone } = require('../../utils/timezoneValidator');
    const validation = validateTimezone(timezoneInput);
    
    if (!validation.isValid) {
        // Create back button to return to Profile Settings
        const { ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
        const backButton = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`profile_settings_${interaction.user.id}`)
                    .setLabel('← Back to Profile Settings')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('⚙️')
            );

        let errorMessage = `❌ **Invalid timezone: "${timezoneInput}"**\n\n` +
                          `Please try:\n` +
                          `• **Locations**: New York, London, Tokyo, California\n` +
                          `• **Abbreviations**: PST, EST, CST, GMT\n` +
                          `• **UTC offsets**: +5, -8, UTC+2\n`;
        
        // Add suggestions if available
        if (validation.suggestions && validation.suggestions.length > 0) {
            errorMessage += `\n**Did you mean?**\n${validation.suggestions.map(s => `• ${s}`).join('\n')}`;
        }

        return await interaction.update({
            content: null,
            components: [backButton],
            embeds: [
                {
                    title: 'Timezone Error',
                    description: errorMessage
                }
            ]
        });
    }

    try {
        // Update or create user record with the validated timezone
        await User.upsert({
            discordId: interaction.user.id,
            username: interaction.user.username,
            discriminator: interaction.user.discriminator || '0',
            avatar: interaction.user.avatar,
            timezone: validation.normalizedTimezone
        });

        // Try to show current time in their timezone for confirmation
        let currentTimePreview = '';
        try {
            const now = new Date();
            if (validation.normalizedTimezone.startsWith('UTC')) {
                // Handle UTC offset display
                currentTimePreview = `\n⏰ **Current time**: ${now.toLocaleString('en-US', { 
                    hour: '2-digit', 
                    minute: '2-digit',
                    hour12: true 
                })} ${validation.normalizedTimezone}`;
            } else {
                // Handle IANA timezone display
                const timeInZone = now.toLocaleString('en-US', {
                    timeZone: validation.normalizedTimezone,
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: true,
                    timeZoneName: 'short'
                });
                currentTimePreview = `\n⏰ **Current time**: ${timeInZone}`;
            }
        } catch (timeError) {
            // If we can't display the time, that's okay
            logger.warn(`Could not display time for timezone ${validation.normalizedTimezone}:`, timeError);
        }

        const responseMessage = `🌍 **Timezone set successfully!**\n\n` +
                              `Your timezone has been set to: **${validation.normalizedTimezone}**${currentTimePreview}\n\n` +
                              `✅ Your profile will now show your local time\n` +
                              `✅ Others can see when it's a good time to chat\n` +
                              `✅ You can change display format anytime\n\n` +
                              `Use **Profile Settings** → **Timezone Display** to choose how it appears!`;

        // Create back button to return to Profile Settings
        const { ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
        
        const backButton = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(originalMessageId ? `profile_settings_${interaction.user.id}_${originalMessageId}` : `profile_settings_${interaction.user.id}`)
                    .setLabel('← Back to Profile Settings')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('⚙️')
            );

        // Update the profile settings message with success and back button
        await interaction.update({
            content: responseMessage,
            components: [backButton],
            embeds: []
        });

        logger.info(`Timezone Modal: Successfully updated interaction. About to attempt dual update with originalMessageId: ${originalMessageId}`);

        // If we have message tracking, try to update the original profile
        if (originalMessageId) {
            try {
                logger.info(`Attempting to update profile message ${originalMessageId} after timezone change`, { service: 'discord-bot' });
                
                // Try to update the original profile message in the background
                const channel = interaction.channel;
                const originalMessage = await channel.messages.fetch(originalMessageId);
                
                if (originalMessage) {
                    logger.info(`Successfully fetched original message ${originalMessageId}`, { service: 'discord-bot' });
                    
                    // Extract the profile owner from the original message embed fields
                    const originalEmbed = originalMessage.embeds[0];
                    if (originalEmbed && originalEmbed.fields) {
                        const userIdField = originalEmbed.fields.find(field => field.name === 'User ID');
                        if (userIdField && userIdField.value === interaction.user.id) {
                            logger.info(`Profile ownership verified for message ${originalMessageId}`, { service: 'discord-bot' });
                            
                            // Fetch fresh user data and regenerate profile
                            const profileOwnerUser = await interaction.client.users.fetch(interaction.user.id);
                            const [user] = await User.findOrCreate({
                                where: { discordId: interaction.user.id },
                                defaults: { 
                                    discordId: interaction.user.id,
                                    username: profileOwnerUser.username,
                                    discriminator: profileOwnerUser.discriminator || '0',
                                    avatar: profileOwnerUser.avatar
                                }
                            });
                            
                            logger.info(`Fresh user data retrieved. Timezone: ${user.timezone}, Display: ${user.timezoneDisplay}`, { service: 'discord-bot' });
                            
                            // Import profile utilities
                            const { generateProfileCard, createProfileButtons } = require('../../utils/profileCard');
                            
                            // Generate fresh profile with updated timezone
                            const { embed } = await generateProfileCard(profileOwnerUser, user, interaction.client, interaction);
                            const profileButtons = createProfileButtons(interaction.user.id, interaction.user.id, originalMessageId);
                            
                            // Update the original profile message
                            await originalMessage.edit({
                                embeds: [embed],
                                components: profileButtons
                            });
                            
                            logger.info(`Successfully updated profile message ${originalMessageId} after timezone change`, { service: 'discord-bot' });
                        } else {
                            logger.warn(`Profile ownership verification failed for message ${originalMessageId}. Expected: ${interaction.user.id}, Found: ${userIdField?.value}`, { service: 'discord-bot' });
                        }
                    } else {
                        logger.warn(`Could not find embed or fields in message ${originalMessageId}`, { service: 'discord-bot' });
                    }
                } else {
                    logger.warn(`Could not fetch original message ${originalMessageId}`, { service: 'discord-bot' });
                }
            } catch (profileUpdateError) {
                logger.error(`Failed to update original profile message ${originalMessageId} after timezone change:`, profileUpdateError);
            }
        }

        logger.info(`User ${interaction.user.tag} set timezone to ${validation.normalizedTimezone}${originalMessageId ? ' (with profile update)' : ''}`);
    } catch (error) {
        logger.error(`Error setting timezone for ${interaction.user.tag}:`, error);
        
        // Create back button to return to Profile Settings
        const { ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
        const backButton = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`profile_settings_${interaction.user.id}`)
                    .setLabel('← Back to Profile Settings')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('⚙️')
            );

        await interaction.update({
            content: '❌ **Something went wrong saving your timezone.**\n\nPlease try again!',
            components: [backButton],
            embeds: []
        });
    }
}

module.exports = { handleTimezoneModal };