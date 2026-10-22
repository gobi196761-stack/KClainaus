// Lainauslomake: tallennus palvelimen kautta voimassa olevalla istunnolla (ks. api/tallenna.js).
const istunto = JSON.parse(sessionStorage.getItem('kc_istunto') || 'null');
document.getElementById('isantaEmail').value = istunto.isantaEmail;
document.getElementById('vierasEmail').value = istunto.vierasEmail;

const $ = (id) => document.getElementById(id);
const nakyvat = (luokka) => Array.from(document.querySelectorAll(`.${luokka}`))
    .filter((c) => !c.closest('.ehdollinen[hidden]'));
const valitut = (luokka) => nakyvat(luokka).filter((c) => c.checked).map((c) => c.value);
const TARKISTUKSET = ['isanta-check', 'vieras-check', 'yhteinen-check'];

// Oletusajat: alku nyt (tasatunti), palautus samana iltana klo 20
function paikallinen(d) {
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
const nyt = new Date();
nyt.setMinutes(0, 0, 0);
$('alku').value = paikallinen(nyt);
const ilta = new Date(nyt);
ilta.setHours(Math.max(20, nyt.getHours() + 2));
$('palautus').value = paikallinen(ilta);

// Meren ja kosken kysymykset näkyvät vain valitulle retkityypille
function paivitaTyyppi() {
    document.querySelectorAll('.ehdollinen').forEach((osa) => {
        osa.hidden = osa.dataset.tyyppi !== $('tyyppi').value;
    });
    paivitaEdistyminen();
}

function paivitaEdistyminen() {
    const kaikki = TARKISTUKSET.flatMap(nakyvat);
    const valmiit = kaikki.filter((c) => c.checked).length;
    $('edistyminen').textContent = `Tarkistettu ${valmiit} / ${kaikki.length}`;
    kaikki.forEach((c) => c.checked && c.closest('label').classList.remove('puuttuu'));
}

$('tyyppi').addEventListener('change', paivitaTyyppi);
document.addEventListener('change', (e) => { if (e.target.type === 'checkbox') paivitaEdistyminen(); });
paivitaTyyppi();

function puutteet() {
    const puuttuu = [];
    if (!$('isantaNimi').value.trim() || !$('vierasNimi').value.trim()) puuttuu.push('osapuolten nimet');
    if (!$('tyyppi').value) puuttuu.push('retken tyyppi');
    if (!$('kohde').value.trim()) puuttuu.push('kohde ja reitti');
    if (!$('alku').value || !$('palautus').value) puuttuu.push('lainan alku ja palautus');
    else if ($('palautus').value <= $('alku').value) puuttuu.push('palautuksen pitää olla alun jälkeen');
    if (!$('kajakki').value.trim()) puuttuu.push('lainattava kajakki');
    const rastimatta = TARKISTUKSET.flatMap(nakyvat).filter((c) => !c.checked);
    rastimatta.forEach((c) => c.closest('label').classList.add('puuttuu'));
    if (rastimatta.length) puuttuu.push(`${rastimatta.length} tarkistuskohtaa (merkitty oranssilla)`);
    return { puuttuu, ensimmainen: rastimatta[0] };
}

$('lahetaBtn').onclick = async function () {
    const { puuttuu, ensimmainen } = puutteet();
    if (puuttuu.length) {
        alert('Täydennä vielä:\n• ' + puuttuu.join('\n• '));
        if (ensimmainen) ensimmainen.closest('label').scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
    }
    const muut = $('muutVarusteet').value.trim();
    const data = {
        istunto: istunto.istunto,
        isantaNimi: $('isantaNimi').value.trim(),
        vierasNimi: $('vierasNimi').value.trim(),
        tyyppi: $('tyyppi').options[$('tyyppi').selectedIndex].text,
        kohde: $('kohde').value.trim(),
        alku: $('alku').value,
        palautus: $('palautus').value,
        kajakki: $('kajakki').value.trim(),
        varusteet: [...valitut('varuste'), ...(muut ? [muut] : [])],
        isantaCheck: valitut('isanta-check'),
        vierasCheck: valitut('vieras-check'),
        yhteinenCheck: valitut('yhteinen-check'),
    };

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
