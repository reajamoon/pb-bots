import sequelize from '../sequelize.js';
import DeanSprints from './DeanSprints.js';
import createUser from './User.js';

// Initialize User from factory pattern used in this repo
const User = createUser(sequelize);

// Set up associations for sprint achievement access via user
DeanSprints.belongsTo(User, { foreignKey: 'userId', targetKey: 'discordId', as: 'user' });
User.hasMany(DeanSprints, { foreignKey: 'userId', sourceKey: 'discordId', as: 'sprints' });

export { User, DeanSprints };
