const firebaseConfig = {
  apiKey: "AIzaSyAJ7NZHIiwYbICxjMcCyZY3TGH7YhFmpvw",
  authDomain: "kclainaus.firebaseapp.com",
  databaseURL: "https://kclainaus-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "kclainaus",
  storageBucket: "kclainaus.firebasestorage.app",
  messagingSenderId: "785222933901",
  appId: "1:785222933901:web:df0ab0bf9ee983e64e71c4"
};

firebase.initializeApp(firebaseConfig);
emailjs.init("DnLC7GQCglOezkCfw");

document.getElementById('lahetaBtn').onclick = async function() {
    const data = {
        isantaNimi: document.getElementById('isantaNimi').value,
        isantaEmail: document.getElementById('isantaEmail').value,
        vierasNimi: document.getElementById('vierasNimi').value,
        vierasEmail: document.getElementById('vierasEmail').value,
        isantaCheck: Array.from(document.querySelectorAll('.isanta-check:checked')).map(c => c.value).join(', '),
        vierasCheck: Array.from(document.querySelectorAll('.vieras-check:checked')).map(c => c.value).join(', '),
        pvm: new Date().toISOString().split('T')[0]
    };

    if (!data.isantaNimi || !data.vierasNimi || !data.isantaEmail || !data.vierasEmail) {
        alert('Täytä kaikki tiedot!');
        return;
    }

    try {
        await firebase.database().ref('Lainaukset/' + data.pvm).push(data);
        await emailjs.send('service_wf86l3j', 'template_c08r5lr', { ...data, to_email: data.isantaEmail, reply_to: 'gobi196761@gmail.com' });
        await emailjs.send('service_wf86l3j', 'template_c08r5lr', { ...data, to_email: data.vierasEmail, reply_to: 'gobi196761@gmail.com' });
        alert('Tallennus ja sähköpostit lähetetty!');
    } catch (e) {
        alert('Virhe: ' + e.message);
        console.error(e);
    }
};
