export const VC_SAMPLE_RATE = 48000

export function processVCAudio(buffer :Buffer){
    const data = new Int16Array(buffer);
    const ndata = data.filter((_, idx)=> idx%2);
    return Buffer.from(ndata);
}