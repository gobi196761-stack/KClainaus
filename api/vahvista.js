// Tarkistaa molempien koodit ja antaa allekirjoitetun istunnon, jolla lomakkeen voi tallentaa.
const kc = require('./_kc');

const ISTUNTO_MS = 2 * 60 * 60 * 1000;

module.exports = kc.kasittelija(async (runko, res) => {
    const haaste = kc.tarkista(runko.haaste, 'haaste');
    if (!haaste) return kc.vastaa(res, 401, { virhe: 'Koodit ovat vanhentuneet, lähetä uudet' });
    if (!kc.samaKoodi(runko.koodi1, haaste.isantaEmail, haaste.t1)
        || !kc.samaKoodi(runko.koodi2, haaste.vierasEmail, haaste.t2)) {
        return kc.vastaa(res, 401, { virhe: 'Virheelliset koodit' });
    }
    const exp = Date.now() + ISTUNTO_MS;
    const istunto = kc.allekirjoita({
        tyyppi: 'istunto', isantaEmail: haaste.isantaEmail, vierasEmail: haaste.vierasEmail, exp,
    });
    kc.vastaa(res, 200, { istunto, isantaEmail: haaste.isantaEmail, vierasEmail: haaste.vierasEmail, exp });
});
