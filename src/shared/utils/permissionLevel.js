
import { User } from '../../models/index.js';

export function getPermissionLevelFromRoles(roleNames) {
  // Priority order: superadmin > admin > mod > member
  const priority = [
    { name: 'Dr. Badass', level: 'superadmin' },
    { name: 'Angels', level: 'admin' },
    { name: 'Prophets', level: 'mod' },
    { name: 'SPN Fam', level: 'member' }
  ];
  for (const { name, level } of priority) {
    if (roleNames.includes(name)) return level;
  }
  return 'non_member';
}
// Upsert user with correct permission level based on their roles
export async function upsertUserPermissionLevel(guildMember) {
  const roleNames = guildMember.roles.cache.map(role => role.name);
  const permissionLevel = getPermissionLevelFromRoles(roleNames);
  await User.upsert({
    discordId: guildMember.id,
    username: guildMember.user.username,
    permissionLevel,
    // Add other fields as needed
  });
}