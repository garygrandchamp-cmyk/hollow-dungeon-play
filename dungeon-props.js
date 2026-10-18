import {makePropSprite} from './prop-sprites.js?v=b2b82afd5d9ff6581de2d605a6f4ce5bcd2a78fe';
import {makeSolidProp,SOLID_PROP_KINDS} from './solid-props.js?v=b2b82afd5d9ff6581de2d605a6f4ce5bcd2a78fe';
// Furnishings (including the healing shrine/pedestal) have volume; cutouts are
// reserved for effects and small art. Keep kind names unchanged for interaction.
export function makeDungeonProp(THREE,options={}){
 return SOLID_PROP_KINDS.includes(options.kind)?makeSolidProp(THREE,options):makePropSprite(THREE,options);
}
