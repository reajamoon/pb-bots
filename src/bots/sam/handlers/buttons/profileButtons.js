import { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, InteractionFlags } from 'discord.js';
import { User } from '../../../../models/index.js';
import logger from '../../../../shared/utils/logger.js';
import { parseProfileSettingsCustomId, buildModalCustomId, buildSelectMenuCustomId, buildInputCustomId, buildProfileSettingsDoneCustomId, decodeMessageId, getProfileMessageId, buildProfileButtonId } from '../../../../shared/utils/messageTracking.js';
/**
 * Handle profile-related button interactions
 */
// ...existing code...
export { handleProfileButtons };