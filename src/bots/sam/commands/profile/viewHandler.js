import { getOrCreateUser, generateProfileCard, createProfileButtons, canViewProfile } from '../../utils/profileCard.js';

export default async function handleProfileView(interaction) {
    try { console.log('[hunts] handleProfileView: start'); } catch {}
    const targetUser = interaction.options.getUser('user') || interaction.user;
    const user = await getOrCreateUser(targetUser);
    if (!canViewProfile(user, interaction.user.id, targetUser.id)) {
        await interaction.editReply({ content: `${targetUser.username} has chosen to keep their profile private.` });
        return;
    }
    const { embed } = await generateProfileCard(targetUser, user, interaction.client, interaction);
    const buttonRows = createProfileButtons(interaction.user.id, targetUser.id);
    const profileMessage = await interaction.editReply({ embeds: [embed], components: buttonRows });
    try { console.log(`[hunts] handleProfileView: embed sent; selfView=${interaction.user.id === targetUser.id}`); } catch {}
    // Fire Hunt trigger for first profile use when viewing own profile
    try {
        if (interaction.user.id === targetUser.id) {
            const makeSamAnnouncer = (await import('../../utils/huntsAnnouncer.js')).default;
            const fireTrigger = (await import('../../../../shared/hunts/triggerEngine.js')).default;
            const announce = makeSamAnnouncer({ interaction });
            try {
                console.log(`[hunts] Attempting first profile use trigger for userId=${interaction.user.id}`);
            } catch {}
            await fireTrigger('sam.profile.firstUse', { userId: interaction.user.id, announce });
            try {
                console.log(`[hunts] fireTrigger(sam.profile.firstUse) called for userId=${interaction.user.id}`);
            } catch {}
        }
    } catch (err) {
        try { console.warn('[hunts] handleProfileView: error in trigger block', err?.message || err); } catch {}
    }
    if (interaction.user.id === targetUser.id) {
        const updatedButtonRows = createProfileButtons(interaction.user.id, targetUser.id, profileMessage.id);
        await profileMessage.edit({ embeds: [embed], components: updatedButtonRows });
        try { console.log('[hunts] handleProfileView: buttons updated with message id'); } catch {}
    }
}
