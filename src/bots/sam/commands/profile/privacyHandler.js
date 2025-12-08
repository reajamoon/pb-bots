import { getOrCreateUser } from '../../utils/profileCard.js';
import { buildPrivacySettingsMenu } from '../../handlers/buttons/privacy/privacyMenu.js';
import Discord from 'discord.js';
const { MessageFlags } = Discord;

export default async function handlePrivacySettings(interaction) {
    const targetUser = interaction.user;
    const user = await getOrCreateUser(targetUser);
    const { content, embeds, components } = buildPrivacySettingsMenu(user, targetUser.id);
    if (components && components[0] && components[0].components) {
        components[0].components = components[0].components.map(btn => {
            if (btn.customId && btn.customId.startsWith('return_profile')) {
                btn.customId = `return_profile_${targetUser.id}`;
            }
            return btn;
        });
    }
    await interaction.editReply({
        content,
        embeds,
        components,
        flags: MessageFlags.Ephemeral
    });
}
