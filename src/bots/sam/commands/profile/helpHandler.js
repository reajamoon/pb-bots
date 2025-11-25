import { createProfileHelpMain } from '../../utils/profileHelp.js';
import logger from '../../../../shared/utils/logger.js';
import Discord from 'discord.js';

export default async function handleProfileHelp(interaction) {
        logger.info(`[handleProfileHelp] Called with interaction.customId=${interaction.customId}`);
        const { embed, components } = createProfileHelpMain(interaction);
        embed.setDescription(embed.description && embed.description.length > 0 ? embed.description : 'Profile help and navigation.');
        const { InteractionFlags } = Discord;
        const ephemeralFlag = InteractionFlags?.Ephemeral ?? 64;
        if (interaction.isButton && interaction.isButton()) {
                // If the original message is not ephemeral, reply with a new ephemeral message
                if (!interaction.message?.flags || !(interaction.message.flags & ephemeralFlag)) {
                        if (!interaction.replied && !interaction.deferred) {
                                await interaction.reply({ embeds: [embed], components, flags: ephemeralFlag });
                        } else {
                                await interaction.followUp({ embeds: [embed], components, flags: ephemeralFlag });
                        }
                } else {
                        await interaction.update({ embeds: [embed], components, flags: ephemeralFlag });
                }
        } else {
                await interaction.editReply({ embeds: [embed], components, flags: ephemeralFlag });
        }
}
