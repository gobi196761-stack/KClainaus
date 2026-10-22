// Tallentaa lainauksen ja lähettää vahvistuksen molemmille – vain voimassa olevalla istunnolla.
// Sähköpostit otetaan istunnosta (vahvistetut osoitteet), ei lomakkeelta.
const kc = require('./_kc');

const teksti = (v, max = 200) => String(v || '').trim().slice(0, max);
const lista = (v) => (Array.isArray(v) ? v : []).map((x) => teksti(x)).filter(Boolean).slice(0, 50).join(', ');

module.exports = kc.kasittelija(async (runko, res) => {
    const istunto = kc.tarkista(runko.istunto, 'istunto');
    if (!istunto) return kc.vastaa(res, 401, { virhe: 'Kirjaudu uudelleen' });

    const data = {
        isantaNimi: teksti(runko.isantaNimi),
        isantaEmail: istunto.isantaEmail,
        vierasNimi: teksti(runko.vierasNimi),
        vierasEmail: istunto.vierasEmail,
        isantaCheck: lista(runko.isantaCheck),
        vierasCheck: lista(runko.vierasCheck),
        yhteinenCheck: lista(runko.yhteinenCheck),
        pvm: new Date().toISOString().split('T')[0],
    };
    if (!data.isantaNimi || !data.vierasNimi) return kc.vastaa(res, 400, { virhe: 'Täytä nimet' });

    await kc.firebaseLisaa(`Lainaukset/${data.pvm}`, data);
    await Promise.all([data.isantaEmail, data.vierasEmail].map((to_email) =>
        kc.lahetaEmail(kc.VAHVISTUS_TEMPLATE, { ...data, to_email })));
    kc.vastaa(res, 200, { ok: true });
});
