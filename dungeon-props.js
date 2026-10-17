import {makePropSprite} from './prop-sprites.js?v=f0cb778312a3fd1be533dc2077710664190052d0';
import {makeSolidProp,SOLID_PROP_KINDS} from './solid-props.js?v=f0cb778312a3fd1be533dc2077710664190052d0';
// Furnishings (including the healing shrine/pedestal) have volume; cutouts are
// reserved for effects and small art. Keep kind names unchanged for interaction.
export function makeDungeonProp(THREE,options={}){
 return SOLID_PROP_KINDS.includes(options.kind)?makeSolidProp(THREE,options):makePropSprite(THREE,options);
}
