// Kahden hengen vahvistus: koodit luodaan ja tarkistetaan palvelimella (api/), selain saa vain
// allekirjoitetun haasteen ja lopuksi istunnon.
let haaste = null;

async function postaa(polku, runko) {
    const vastaus = await fetch(polku, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(runko),
    });
    const data = await vastaus.json().catch(() => ({}));
    if (!vastaus.ok) throw new Error(data.virhe || `Virhe ${vastaus.status}`);
    return data;
}

async function sendCodes() {
    const isantaEmail = document.getElementById('email1').value.trim();
    const vierasEmail = document.getElementById('email2').value.trim();
    if (!isantaEmail || !vierasEmail) return alert('Täytä molemmat sähköpostit');
    const nappi = document.getElementById('lahetaKoodit');
    nappi.disabled = true;
    try {
        haaste = (await postaa('/api/laheta-koodit', { isantaEmail, vierasEmail })).haaste;
        document.getElementById('codeArea').style.display = 'block';
        alert('Koodit lähetetty molemmille!');
    } catch (e) {
        alert(e.message);
    } finally {
        nappi.disabled = false;
    }
}

async function verifyCodes() {
    if (!haaste) return alert('Lähetä ensin koodit');
    try {
        const tulos = await postaa('/api/vahvista', {
            haaste,
            koodi1: document.getElementById('code1').value,
            koodi2: document.getElementById('code2').value,
        });
        sessionStorage.setItem('kc_istunto', JSON.stringify(tulos));
        window.location.href = 'kclainaus.html';
    } catch (e) {
        alert(e.message);
    }
}
