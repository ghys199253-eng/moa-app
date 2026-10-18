/** Select the next visible article after a confirmed deletion. */
/** Preserve the caller's filtered and sorted list; do not wrap around. */
export function nextAfterRemoving<T extends {id:string}>(
 visible:readonly T[], removedId:string
):T|null{
 const index=visible.findIndex(item=>item.id===removedId);
 if(index<0)return null;
 return visible[index+1]??visible[index-1]??null;
}
