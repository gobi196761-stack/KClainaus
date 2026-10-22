// Lainauslomake: tallennus palvelimen kautta voimassa olevalla istunnolla (ks. api/tallenna.js).
const istunto = JSON.parse(sessionStorage.getItem('kc_istunto') || 'null');
document.getElementById('isantaEmail').value = istunto.isantaEmail;
document.getElementById('vierasEmail').value = istunto.vierasEmail;

const valitut = (luokka) => Array.from(document.querySelectorAll(`.${luokka}:checked`)).map((c) => c.value);

document.getElementById('lahetaBtn').onclick = async function () {
    const data = {
        istunto: istunto.istunto,
        isantaNimi: document.getElementById('isantaNimi').value.trim(),
        vierasNimi: document.getElementById('vierasNimi').value.trim(),
        isantaCheck: valitut('isanta-check'),
        vierasCheck: valitut('vieras-check'),
        yhteinenCheck: valitut('yhteinen-check'),
    };
    if (!data.isantaNimi || !data.vierasNimi) return alert('Täytä kaikki tiedot!');

    this.disabled = true;
    try {
        const vastaus = await fetch('/api/tallenna', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
        });
        const tulos = await vastaus.json().catch(() => ({}));
        if (vastaus.status === 401) {
            sessionStorage.removeItem('kc_istunto');
            alert(tulos.virhe || 'Kirjaudu uudelleen');
            return window.location.replace('login.html');
        }
        if (!vastaus.ok) throw new Error(tulos.virhe || `Virhe ${vastaus.status}`);
        alert('Tallennus ja sähköpostit lähetetty!');
    } catch (e) {
        alert('Virhe: ' + e.message);
    } finally {
        this.disabled = false;
    }
};
