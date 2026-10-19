import {makePropSprite} from './prop-sprites.js?v=1d78ea79feefea23b13aa344fdb80a6c28d88fec';
import {makeSolidProp,SOLID_PROP_KINDS} from './solid-props.js?v=1d78ea79feefea23b13aa344fdb80a6c28d88fec';
// Furnishings (including the healing shrine/pedestal) have volume; cutouts are
// reserved for effects and small art. Keep kind names unchanged for interaction.
export function makeDungeonProp(THREE,options={}){
 return SOLID_PROP_KINDS.includes(options.kind)?makeSolidProp(THREE,options):makePropSprite(THREE,options);
}
