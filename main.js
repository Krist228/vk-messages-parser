const prompt = require('prompt-sync')();
const VK = require('vk-io');
const fs = require('fs');

async function main() {

  // Запрос логина/пароля
  const login = prompt('Логин: '),
        pass  = prompt('Пароль: ');

  // Авторизация
  const vk = new VK({
    login,
    pass,
    lang: 'ru'
  });
  const { token } = await vk.auth.iphone().run();
  vk.setToken(token);

  // Открытие файла для записи
  const dir = `./${login}-${new Date().getTime()}`;
  fs.mkdirSync(dir);

  // Получение всех переписок
  for (
    let response, offset = 0;
    response = await vk.api.call('messages.getConversations',
      {
        count: 200,
        offset
      }),
    response.items.length > 0;
    offset += 200
  ) {

    const conversations = response.items.map(item => item.conversation);
    for (let conversation of conversations) {
      const file = await fs.createWriteStream(`${dir}/${conversation.peer.local_id}.txt`, { flags: 'w+' });
      console.log(`Загрузка ${conversation.peer.local_id}...`);

      for (
        let last_sender_id, last_message_id, offset = 0;
        last_message_id !== conversation.last_message_id;
        offset += 200
      ) {

        // Получение всех сообщений
        const { items: messages } = await vk.api.call('messages.getHistory',
          {
            peer_id: conversation.peer.local_id,
            rev: 1,
            count: 200,
            offset
          });

        for (let message of messages) {
          const sender_id = message.from_id;

          // Имя отправителя
          if (last_sender_id !== sender_id) {
            const sender = (await vk.api.call('users.get', {user_ids: sender_id}))[0];
            file.write(`${sender.first_name} ${sender.last_name}:\n`);
          }

          // Сообщение
          file.write((message.body || '(вложение)') + "\n");

          last_sender_id = sender_id;
          last_message_id = message.id;
        }

      }

      file.end();
    }

  }

  console.log('Готово!');

}

main()
  .catch(console.error)
  .finally(prompt);
