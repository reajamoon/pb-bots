import { Op, QueryTypes } from 'sequelize';
import { ModmailRelay, sequelize } from '../../models/index.js';

export async function createModmailRelayWithNextTicket({
  botName,
  userId,
  threadId,
  baseMessageId,
  ficUrl = null,
}) {
  const maxAttempts = 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await sequelize.transaction(async (transaction) => {
        if (sequelize.getDialect() === 'postgres') {
          await sequelize.query(
            'SELECT pg_advisory_xact_lock(hashtext(:lockKey))',
            {
              replacements: { lockKey: `modmailrelay:${botName}` },
              type: QueryTypes.SELECT,
              transaction,
            }
          );
        }

        const last = await ModmailRelay.findOne({
          where: {
            bot_name: botName,
            ticket_seq: { [Op.ne]: null },
          },
          order: [['ticket_seq', 'DESC']],
          transaction,
        });

        const nextSeq = (last && last.ticket_seq ? last.ticket_seq : 0) + 1;
        const ticket = `${String(botName).toUpperCase()}-${nextSeq}`;

        const relay = await ModmailRelay.create(
          {
            user_id: userId,
            bot_name: botName,
            ticket_number: ticket,
            ticket_seq: nextSeq,
            fic_url: ficUrl,
            base_message_id: baseMessageId,
            thread_id: threadId,
            open: true,
            status: 'open',
            created_at: new Date(),
            last_user_message_at: new Date(),
          },
          { transaction }
        );

        return { relay, ticket };
      });
    } catch (err) {
      const code = err?.parent?.code || err?.original?.code || err?.code;
      if (code === '23505' && attempt < maxAttempts) {
        continue;
      }
      throw err;
    }
  }

  throw new Error('Failed to allocate a unique modmail ticket number');
}
