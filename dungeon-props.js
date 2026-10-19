import {makePropSprite} from './prop-sprites.js?v=5d7531948dcd036925fc96b539d81165ba86fa3a';
import {makeSolidProp,SOLID_PROP_KINDS} from './solid-props.js?v=5d7531948dcd036925fc96b539d81165ba86fa3a';
// Furnishings (including the healing shrine/pedestal) have volume; cutouts are
// reserved for effects and small art. Keep kind names unchanged for interaction.
export function makeDungeonProp(THREE,options={}){
 return SOLID_PROP_KINDS.includes(options.kind)?makeSolidProp(THREE,options):makePropSprite(THREE,options);
}
