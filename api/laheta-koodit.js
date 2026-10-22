// Lähettää kummallekin osapuolelle oman vahvistuskoodin. Koodit eivät koskaan päädy selaimeen:
// vastauksena tulee vain allekirjoitettu haaste, jossa on koodien avaimelliset tiivisteet.
const kc = require('./_kc');

const VOIMASSA_MS = 15 * 60 * 1000;

module.exports = kc.kasittelija(async (runko, res) => {
    const isanta = kc.normalisoiEmail(runko.isantaEmail);
    const vieras = kc.normalisoiEmail(runko.vierasEmail);
    if (!kc.kelpoEmail(isanta) || !kc.kelpoEmail(vieras)) {
        return kc.vastaa(res, 400, { virhe: 'Tarkista sähköpostiosoitteet' });
    }
    if (isanta === vieras) return kc.vastaa(res, 400, { virhe: 'Osapuolilla pitää olla eri sähköpostit' });

    const koodi1 = kc.uusiKoodi(), koodi2 = kc.uusiKoodi();
    await Promise.all([
        kc.lahetaEmail(kc.KOODI_TEMPLATE, { to_email: isanta, koodi: koodi1 }),
        kc.lahetaEmail(kc.KOODI_TEMPLATE, { to_email: vieras, koodi: koodi2 }),
    ]);
    const haaste = kc.allekirjoita({
        tyyppi: 'haaste', isantaEmail: isanta, vierasEmail: vieras,
        t1: kc.koodinTiiviste(koodi1, isanta), t2: kc.koodinTiiviste(koodi2, vieras),
        exp: Date.now() + VOIMASSA_MS,
    });
    kc.vastaa(res, 200, { haaste });
});
