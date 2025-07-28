const form = document.getElementById('co-form')

function getTelegramUserId() {
  if (window.Telegram && Telegram.WebApp && Telegram.WebApp.initDataUnsafe) {
    const user = Telegram.WebApp.initDataUnsafe.user;
    if (user && user.id) {
      return user.id;
    }
  }
  return null;
}

 document.addEventListener("DOMContentLoaded", () => {
  Telegram.WebApp.ready();
  const id = getTelegramUserId();
  const startParam = Telegram.WebApp.initDataUnsafe?.start_param;
  window.tgUserId = id;
  window.tgUserStartParam = startParam;
});

async function updateSelectOptions() {
  const select = document.getElementById('chosen_date');

  try {
    const response = await fetch('https://ndb.fut.ru/api/v2/tables/msld4818olw3gxi/records', {
      headers: {
        'accept': 'application/json',
        'xc-token': 'crDte8gB-CSZzNujzSsy9obQRqZYkY3SNp8wre88'
      }
    });

    const data = await response.json();

    data.list.forEach(item => {
      const option = select.querySelector(`option[value="${item.number}"]`);
      if (option) {
        option.textContent = item.time;
      }
    });

  } catch (error) {
    console.error('Ошибка при загрузке данных из NocoDB:', error);
  }
}

updateSelectOptions();

form.addEventListener('submit', async function (e) {
  const formData = new FormData(form);
  const errorEl = document.getElementById('reg-error');
  e.preventDefault();

  const submitBtn = this.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.textContent = 'ОТПРАВЛЯЕТСЯ...'
  submitBtn.style.backgroundColor = '#ccc';
  submitBtn.style.color = '#666';
  setTimeout(() => {
    submitBtn.disabled = false;
    submitBtn.textContent = 'ОТПРАВИТЬ'
    submitBtn.style.backgroundColor = '';
    submitBtn.style.color = '';
  }, 9000);
  
  try {
    const response = await fetch(`https://ndb.fut.ru/api/v2/tables/maiff22q0tefj6t/records/?where=(tg-id,eq,${window.tgUserId})`, {
      method: 'GET',
      headers: {
        'accept': 'application/json',
        'xc-token': 'crDte8gB-CSZzNujzSsy9obQRqZYkY3SNp8wre88'
      }
    });

    const candidate_data = await response.json();

    if (!candidate_data.list || candidate_data.list.length === 0) {
      errorEl.textContent = 'Не нашли тебя в базе регистрации! Пожалуйста, свяжись с нами через бота или повтори попытку ещё раз';
      return;
    }
    window.record_id = candidate_data.list[0]['Id']
    window.email = candidate_data.list[0]['E-mail']
    window.name = candidate_data.list[0]['Имя']
    window.surname = candidate_data.list[0]['Фамилия']

  }
  catch (err) {
    console.error(err);
    errorEl.textContent = 'Ошибка сервера. Повтори попытку позже';
    }
    
  
  try {
    const res = await fetch('https://ndb.fut.ru/api/v2/tables/m5rqqcrb6olwr0q/records', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'accept': 'application/json',
        'xc-token': 'crDte8gB-CSZzNujzSsy9obQRqZYkY3SNp8wre88'
      },
      body: JSON.stringify({
        "chosen_option": document.querySelector('select[name="chosen_date"]').querySelector(`option[value="${formData.get('chosen_date')}"]`)?.textContent,
        "telegram_id": window.tgUserId,
        "email": window.email,
        "name": window.name,
        "surname": window.surname,
        "request_date": new Date().toLocaleDateString('ru-RU'),
        "request_time": new Date().toLocaleTimeString('ru-RU', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        }) 
      })
    }
    )
    if (window.tgUserStartParam == 'first_choice') {
    const res2 = await fetch('https://ndb.fut.ru/api/v2/tables/maiff22q0tefj6t/records', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'accept': 'application/json',
        'xc-token': 'crDte8gB-CSZzNujzSsy9obQRqZYkY3SNp8wre88'
      },
      body: JSON.stringify({
        "Id": window.record_id,
        cd24ymeg17efph2: document.querySelector('select[name="chosen_date"]').querySelector(`option[value="${formData.get('chosen_date')}"]`)?.textContent
      })
    }
    )
  } else if (window.tgUserStartParam == 'second_choice') {
    const res2 = await fetch('https://ndb.fut.ru/api/v2/tables/maiff22q0tefj6t/records', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'accept': 'application/json',
        'xc-token': 'crDte8gB-CSZzNujzSsy9obQRqZYkY3SNp8wre88'
      },
      body: JSON.stringify({
        "Id": window.record_id,
        ccbhkw1b8wrncal: document.querySelector('select[name="chosen_date"]').querySelector(`option[value="${formData.get('chosen_date')}"]`)?.textContent
      })
    }
    )
  } else if (window.tgUserStartParam == 'third_choice') {
    const res2 = await fetch('https://ndb.fut.ru/api/v2/tables/maiff22q0tefj6t/records', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'accept': 'application/json',
        'xc-token': 'crDte8gB-CSZzNujzSsy9obQRqZYkY3SNp8wre88'
      },
      body: JSON.stringify({
        "Id": window.record_id,
        cz17jhzpscw313c: document.querySelector('select[name="chosen_date"]').querySelector(`option[value="${formData.get('chosen_date')}"]`)?.textContent
      })
    }
    )
  }
    window.location.href = 'bye.html'
  }
  catch (err) {
    console.error(err);
    errorEl.textContent = 'Ошибка сервера. Повтори попытку позже';
    }
});
