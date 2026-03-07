// components/ui/brandLogos.ts
// ── Add new URLs here anytime — BrandLogo.tsx never changes ──

const CDN = 'https://res.cloudinary.com/dguu7htoa/image/upload';

export const BRAND_LOGOS: Record<string, string> = {
    // ── Batch 1 ────────────────────────────────────────────────
    speedway:  `${CDN}/Speedway_urnqqg.png`,
    wawa:      `${CDN}/Wawa_htexyi.png`,
    sunoco:    `${CDN}/Sunoco_kds423.png`,
    shell:     `${CDN}/Shell_pso6qe.png`,
    loves:     `${CDN}/Love_s_Travel_Stops_vvhok2.png`,
    marathon:  `${CDN}/Marathon_Petroleum_z2votb.png`,
    bp:        `${CDN}/BP_utoph6.png`,
    valero:    `${CDN}/Valero_ahyqhl.png`,
    circle_k:  `${CDN}/Circle_K_fok7lu.png`,
    kwik_trip: `${CDN}/Kwik_Trip_n54aoa.png`,
    citgo:     `${CDN}/CITGO_p0hf4k.png`,
    chevron:   `${CDN}/Chevron_filnqm.png`,
    exxon:     `${CDN}/ExxonMobil_fjrc10.png`,

    // ── Batch 2 ────────────────────────────────────────────────
    pilot:     `${CDN}/v1772824999/Pilot_p_ecc9sb.jpg`,
    gulf:      `${CDN}/v1772824999/Gulf_Oil_p_jf71rl.png`,
    sheetz:    `${CDN}/v1772824999/Sheetz_p_yplxkh.png`,
    ta:        `${CDN}/v1772824998/TravelCenters_of_America_p_iukogd.png`,
    arco:      `${CDN}/v1772824999/ARCO_p_zukr4c.png`,
    costco:    `${CDN}/v1772824998/Costco_p_yihbfk.jpg`,
    caseys:    `${CDN}/v1772824998/Casey_s_p_ioygm2.jpg`,

    // ── Fallback ───────────────────────────────────────────────
    default:   `${CDN}/v1772825387/default_fallback_zhn89l.jpg`,
};

export const FALLBACK_URL = `${CDN}/v1772825387/default_fallback_zhn89l.jpg`;
