import {makePropSprite} from './prop-sprites.js?v=07037d67ba60753b38369cf663434f52919a8df7';
import {makeSolidProp,SOLID_PROP_KINDS} from './solid-props.js?v=07037d67ba60753b38369cf663434f52919a8df7';
// Furnishings (including the healing shrine/pedestal) have volume; cutouts are
// reserved for effects and small art. Keep kind names unchanged for interaction.
export function makeDungeonProp(THREE,options={}){
 return SOLID_PROP_KINDS.includes(options.kind)?makeSolidProp(THREE,options):makePropSprite(THREE,options);
}
