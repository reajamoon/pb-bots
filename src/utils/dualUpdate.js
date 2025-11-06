const { User } = require('../models');
const { generateProfileCard, createProfileButtons } = require('./profileCard');
const logger = require('./logger');

/**
 * Update the original profile message with fresh user data
 * This is the "dual update" - updating both the ephemeral response and the original profile
 * 
 * @param {Interaction} interaction - Discord interaction object
 * @param {string} originalMessageId - ID of the original profile message to update
 * @param {string} actionDescription - Description of what action triggered the update (for logging)
 * @param {Object} options - Additional options
 * @param {boolean} options.skipOwnershipCheck - Skip profile ownership verification (default: false)
 * @returns {Promise<boolean>} - True if update was successful, false otherwise
 */
async function updateOriginalProfile(interaction, originalMessageId, actionDescription, options = {}) {
    if (!originalMessageId) {
        return false;
    }

    try {
        // Fetch the original message
        const message = await interaction.channel.messages.fetch(originalMessageId);
        if (!message) {
            logger.warn(`Could not fetch original message ${originalMessageId} for ${actionDescription}`, { service: 'discord-bot' });
            return false;
        }

        // Verify ownership (bot must own the message)
        if (message.author.id !== interaction.client.user.id) {
            logger.warn(`Profile ownership verification failed for message ${originalMessageId}. Expected bot ID: ${interaction.client.user.id}, Found: ${message.author.id}`, { service: 'discord-bot' });
            return false;
        }

        // Additional ownership check - verify the profile belongs to the interaction user
        if (!options.skipOwnershipCheck) {
            const embed = message.embeds[0];
            if (embed && embed.fields) {
                const userIdField = embed.fields.find(field => field.name === 'User ID');
                if (userIdField && userIdField.value !== interaction.user.id) {
                    logger.warn(`Profile user verification failed for message ${originalMessageId}. Expected: ${interaction.user.id}, Found: ${userIdField.value}`, { service: 'discord-bot' });
                    return false;
                }
            }
        }

        // Get fresh user data from database
        const updatedUser = await User.findByPk(interaction.user.id);
        if (!updatedUser) {
            logger.warn(`Could not fetch updated user data for ${interaction.user.id} during ${actionDescription}`, { service: 'discord-bot' });
            return false;
        }

        // Generate fresh profile embed and buttons
        const { embed } = await generateProfileCard(interaction.user, updatedUser, interaction.client, interaction);
        const buttons = createProfileButtons(interaction.user.id, interaction.user.id, originalMessageId);

        if (!embed) {
            logger.warn(`Profile embed generation failed for ${actionDescription}`, { service: 'discord-bot' });
            return false;
        }

        // Update the original message
        await message.edit({
            embeds: [embed],
            components: buttons
        });

        logger.info(`Successfully updated profile message ${originalMessageId} after ${actionDescription}`, { service: 'discord-bot' });
        return true;

    } catch (error) {
        logger.error(`Error updating profile message ${originalMessageId} after ${actionDescription}:`, error, { service: 'discord-bot' });
        return false;
    }
}

/**
 * Extract message ID from button custom ID
 * Handles both direct message ID format and encoded format
 * 
 * @param {string} customId - Button custom ID
 * @returns {string|null} - Extracted message ID or null if not found
 */
function extractMessageIdFromCustomId(customId) {
    if (!customId) return null;

    // Pattern: action_userId_messageId
    const parts = customId.split('_');
    if (parts.length >= 3) {
        const potentialMessageId = parts[parts.length - 1];
        
        // Check if it's a valid Discord snowflake (18-19 digits)
        if (/^\d{17,19}$/.test(potentialMessageId)) {
            return potentialMessageId;
        }
    }

    return null;
}

/**
 * Dual update helper - updates both ephemeral response and original profile
 * This is a convenience function that combines ephemeral response and profile update
 * 
 * @param {Interaction} interaction - Discord interaction object
 * @param {Object} ephemeralResponse - Ephemeral response data (embeds, components, etc.)
 * @param {string} originalMessageId - ID of original profile message to update
 * @param {string} actionDescription - Description of the action for logging
 * @param {Object} options - Additional options
 * @returns {Promise<boolean>} - True if both updates successful, false otherwise
 */
async function performDualUpdate(interaction, ephemeralResponse, originalMessageId, actionDescription, options = {}) {
    try {
        // If this is a button interaction from an ephemeral message, update instead of reply
        if (interaction.isButton && interaction.message && interaction.message.flags?.has('Ephemeral')) {
            await interaction.update(ephemeralResponse);
        } else if (interaction.replied || interaction.deferred) {
            await interaction.editReply(ephemeralResponse);
        } else {
            await interaction.reply({
                ...ephemeralResponse,
                flags: 64
            });
        }

        // Validate originalMessageId before updating profile
        let validMessageId = null;
        if (originalMessageId && /^\d{17,19}$/.test(originalMessageId)) {
            validMessageId = originalMessageId;
        } else {
            logger.warn(`Invalid originalMessageId provided for dual update: ${originalMessageId}`, { service: 'discord-bot' });
        }

        // Update original profile in background only if valid
        let profileUpdateSuccess = false;
        if (validMessageId) {
            profileUpdateSuccess = await updateOriginalProfile(interaction, validMessageId, actionDescription, options);
        }

        if (profileUpdateSuccess) {
            logger.info(`Dual update completed for ${actionDescription}`, { service: 'discord-bot' });
        }

        return profileUpdateSuccess;

    } catch (error) {
        logger.error(`Error during dual update for ${actionDescription}:`, error, { service: 'discord-bot' });
        return false;
    }
}

module.exports = {
    updateOriginalProfile,
    extractMessageIdFromCustomId,
    performDualUpdate
};