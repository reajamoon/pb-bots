import { getOrCreateUser } from '../../utils/profileCard.js';
import { buildPrivacySettingsMenu } from '../../handlers/buttons/privacy/privacyMenu.js';
import Discord from 'discord.js';
const { MessageFlags } = Discord;

export default async function handlePrivacySettings(interaction) {
    const targetUser = interaction.user;
    const user = await getOrCreateUser(targetUser);
    const { embeds, components } = await buildPrivacySettingsMenu(user, targetUser.id, null);
    await interaction.editReply({
        embeds,
        components,
        flags: MessageFlags.Ephemeral
    });
}
