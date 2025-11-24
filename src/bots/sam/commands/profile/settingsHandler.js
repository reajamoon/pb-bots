import { getOrCreateUser, generateProfileCard, createProfileButtons } from '../../utils/profileCard.js';
import { InteractionFlags } from 'discord.js';

export default async function handleProfileSettings(interaction) {
    const targetUser = interaction.user;
    const user = await getOrCreateUser(targetUser);
    const { embed } = await generateProfileCard(targetUser, user, interaction.client, interaction);
    const buttonRows = createProfileButtons(interaction.user.id, targetUser.id);
    if (buttonRows[0] && buttonRows[0].components) {
        buttonRows[0].components = buttonRows[0].components.map(btn => {
            if (btn.customId && btn.customId.startsWith('return_profile')) {
                btn.customId = `return_profile_${targetUser.id}`;
            }
            return btn;
        });
    }
    const profileSettingsRow = buttonRows[0];
    await interaction.editReply({
        embeds: [embed],
        components: [profileSettingsRow],
        flags: InteractionFlags.Ephemeral
    });
}
