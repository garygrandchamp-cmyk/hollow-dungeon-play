import {makePropSprite} from './prop-sprites.js?v=a41d8717c0b0759a0ee7f52d5e24a2c40358be33';
import {makeSolidProp,SOLID_PROP_KINDS} from './solid-props.js?v=a41d8717c0b0759a0ee7f52d5e24a2c40358be33';
// Furnishings (including the healing shrine/pedestal) have volume; cutouts are
// reserved for effects and small art. Keep kind names unchanged for interaction.
export function makeDungeonProp(THREE,options={}){
 return SOLID_PROP_KINDS.includes(options.kind)?makeSolidProp(THREE,options):makePropSprite(THREE,options);
}
