'use client'
import {useEffect,useRef} from 'react'
// Match the component's container breakpoint, including tablets with the sidebar.
export function useDetailNavigation(selected:string|null|undefined,ready:boolean){
 const detailRef=useRef<HTMLElement>(null),listRef=useRef<HTMLElement>(null)
 useEffect(()=>{
  const detail=detailRef.current
  if(!selected||!ready||!detail)return
  const shell=detail.closest('.er') as HTMLElement|null
  const style=shell?getComputedStyle(shell):null
  const width=shell&&style?shell.clientWidth-parseFloat(style.paddingLeft)-parseFloat(style.paddingRight):Infinity
  if(width<=800){
   detail.focus({preventScroll:true})
   detail.scrollIntoView({block:'start',behavior:'instant'})
  }
 },[selected,ready])
 function returnToList(clear:()=>void){
  clear()
  requestAnimationFrame(()=>{listRef.current?.focus({preventScroll:true});listRef.current?.scrollIntoView({block:'start',behavior:'instant'})})
 }
 return {detailRef,listRef,returnToList}
}
