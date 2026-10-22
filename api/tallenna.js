// Tallentaa lainauksen ja lähettää vahvistuksen molemmille – vain voimassa olevalla istunnolla.
// Sähköpostit otetaan istunnosta (vahvistetut osoitteet), ei lomakkeelta.
//
// Sähköpostipohjan (VAHVISTUS_TEMPLATE) muuttujat: isantaNimi, isantaEmail, vierasNimi, vierasEmail,
// tyyppi, kohde, alku, palautus, kajakki, varusteet, retkiYhteenveto, isantaCheck, vierasCheck,
// yhteinenCheck, pvm.
const kc = require('./_kc');

const TYYPIT = ['Retkimelonta – järvi', 'Retkimelonta – joki (ei koskia)', 'Retkimelonta – meri tai saaristo',
    'Koskimelonta'];
const AIKA = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;   // <input type="datetime-local"> -arvo, Suomen aikaa

const teksti = (v, max = 200) => String(v || '').trim().slice(0, max);
const lista = (v) => (Array.isArray(v) ? v : []).map((x) => teksti(x)).filter(Boolean).slice(0, 50).join(', ');

// "2026-10-23T09:00" -> "23.10.2026 klo 9.00"
function suomeksi(aika) {
    const [pvm, kello] = aika.split('T');
    const [v, k, p] = pvm.split('-').map(Number);
    const [h, m] = kello.split(':');
    return `${p}.${k}.${v} klo ${Number(h)}.${m}`;
}

module.exports = kc.kasittelija(async (runko, res) => {
    const istunto = kc.tarkista(runko.istunto, 'istunto');
    if (!istunto) return kc.vastaa(res, 401, { virhe: 'Kirjaudu uudelleen' });

    const alku = teksti(runko.alku, 16), palautus = teksti(runko.palautus, 16);
    const data = {
        isantaNimi: teksti(runko.isantaNimi),
        isantaEmail: istunto.isantaEmail,
        vierasNimi: teksti(runko.vierasNimi),
        vierasEmail: istunto.vierasEmail,
        tyyppi: teksti(runko.tyyppi),
        kohde: teksti(runko.kohde, 300),
        alku: AIKA.test(alku) ? suomeksi(alku) : '',
        palautus: AIKA.test(palautus) ? suomeksi(palautus) : '',
        kajakki: teksti(runko.kajakki, 120),
        varusteet: lista(runko.varusteet),
        isantaCheck: lista(runko.isantaCheck),
        vierasCheck: lista(runko.vierasCheck),
        yhteinenCheck: lista(runko.yhteinenCheck),
        pvm: new Date().toISOString().split('T')[0],
    };
    if (!data.isantaNimi || !data.vierasNimi) return kc.vastaa(res, 400, { virhe: 'Täytä nimet' });
    if (!TYYPIT.includes(data.tyyppi)) return kc.vastaa(res, 400, { virhe: 'Valitse retken tyyppi' });
    if (!data.kohde || !data.kajakki) return kc.vastaa(res, 400, { virhe: 'Täytä kohde ja kajakki' });
    if (!data.alku || !data.palautus || palautus <= alku) {
        return kc.vastaa(res, 400, { virhe: 'Tarkista lainan alku ja palautus' });
    }
    data.retkiYhteenveto = `${data.tyyppi}: ${data.kohde}, ${data.alku} – ${data.palautus}. ` +
        `Kajakki: ${data.kajakki}${data.varusteet ? `; varusteet: ${data.varusteet}` : ''}.`;

    await kc.firebaseLisaa(`Lainaukset/${data.pvm}`, data);
    await Promise.all([data.isantaEmail, data.vierasEmail].map((to_email) =>
        kc.lahetaEmail(kc.VAHVISTUS_TEMPLATE, { ...data, to_email })));
    kc.vastaa(res, 200, { ok: true });
});
