import { useDispatch, useSelector } from 'react-redux'
import type { RootState, AppDispatch } from '@/store'

// Use these everywhere instead of plain useDispatch / useSelector.
// They have the correct types baked in so you never need to annotate
// RootState or AppDispatch at the call site.
//
// ✅  const dispatch = useAppDispatch()
// ✅  const user = useAppSelector(state => state.auth.user)
//
// ❌  const dispatch = useDispatch<AppDispatch>()   — verbose, easy to forget
// ❌  const user = useSelector((state: RootState) => state.auth.user)  — same

export const useAppDispatch = useDispatch.withTypes<AppDispatch>()
export const useAppSelector = useSelector.withTypes<RootState>()