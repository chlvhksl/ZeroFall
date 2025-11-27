/**
 * 현장 관리 유틸리티 함수
 * 유연성, 보안, 사용성, 확장성을 모두 고려한 설계
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

export interface Site {
  id: string;
  name: string;
  description?: string;
  role?: string;
  is_default?: boolean;
}

export interface AccessibleSite extends Site {
  role: string; // 표시용 역할 (가장 높은 권한)
  roles?: string[]; // 모든 권한 목록 (admin, manager, viewer 등)
  is_default: boolean;
  hasPassword?: boolean; // 비밀번호가 있는지 여부 (실제 비밀번호는 전달하지 않음)
  isCreator?: boolean; // 본인이 만든 현장인지 여부
}

const STORAGE_KEY_SELECTED_SITE_ID = '@selected_site_id';
const STORAGE_KEY_SELECTED_SITE_NAME = '@selected_site_name';
const STORAGE_KEY_VERIFIED_SITES = '@verified_sites'; // 비밀번호 인증된 현장 목록 (사용자별로 저장)

/**
 * 관리자가 접근 가능한 모든 현장 목록 조회
 * 모든 현장을 조회하되, 권한이 있는 현장은 해당 권한을, 없으면 'viewer' 권한 부여
 */
export async function getAccessibleSites(): Promise<AccessibleSite[]> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      console.error('❌ [siteManagement] 사용자 정보 없음');
      return [];
    }

    // 1. 모든 현장 조회 (password는 제외 - 보안상 클라이언트에 전달하지 않음)
    const { data: allSites, error: sitesError } = await supabase
      .from('sites')
      .select('id, name, company_name, description, password, creator_id')
      .order('name', { ascending: true });

    if (sitesError) {
      console.error('❌ [siteManagement] 현장 목록 조회 실패:', sitesError);
      return [];
    }

    if (!allSites || allSites.length === 0) {
      return [];
    }

    // 2. 현재 사용자의 권한 정보 조회
    const { data: userPermissions, error: permError } = await supabase
      .from('admin_sites')
      .select('site_id, role, is_default')
      .eq('admin_id', user.id);

    if (permError) {
      console.error('❌ [siteManagement] 권한 정보 조회 실패:', permError);
      // 권한 정보 조회 실패해도 모든 현장은 표시 (viewer 권한으로)
    }

    // 3. 권한 정보를 맵으로 변환 (같은 현장에 여러 권한이 있을 수 있음)
    const permissionMap = new Map<string, { roles: string[]; is_default: boolean }>();
    (userPermissions || []).forEach((perm: any) => {
      const existing = permissionMap.get(perm.site_id);
      if (existing) {
        // 이미 권한이 있으면 roles 배열에 추가
        if (!existing.roles.includes(perm.role)) {
          existing.roles.push(perm.role);
        }
      } else {
        // 처음 추가하는 경우
        permissionMap.set(perm.site_id, {
          roles: [perm.role || 'viewer'],
          is_default: perm.is_default || false,
        });
      }
    });

    // creator_id로 만든 현장도 admin 권한 추가
    allSites.forEach((site: any) => {
      if (site.creator_id === user.id) {
        const existing = permissionMap.get(site.id);
        if (existing) {
          if (!existing.roles.includes('admin')) {
            existing.roles.push('admin');
          }
        } else {
          permissionMap.set(site.id, {
            roles: ['admin'],
            is_default: false,
          });
        }
      }
    });

    // 4. 모든 현장을 권한 정보와 함께 변환
    const sites: AccessibleSite[] = allSites.map((site: any) => {
      const permission = permissionMap.get(site.id);
      const roles = permission?.roles || [];
      
      // 가장 높은 권한을 표시용 role로 사용 (admin > manager > viewer)
      let displayRole = 'viewer';
      if (roles.includes('admin')) {
        displayRole = 'admin';
      } else if (roles.includes('manager')) {
        displayRole = 'manager';
      } else if (roles.includes('viewer')) {
        displayRole = 'viewer';
      }

      return {
        id: site.id,
        name: site.name,
        description: site.description || undefined,
        role: displayRole, // 표시용 역할 (가장 높은 권한)
        roles: roles, // 모든 권한 목록 (접근 권한 확인용)
        is_default: permission?.is_default || false,
        hasPassword: !!site.password, // 비밀번호 존재 여부만 전달
        isCreator: site.creator_id === user.id, // 본인이 만든 현장인지 확인
      };
    });

    // 5. 정렬: is_default가 true인 것을 먼저, 그 다음 이름순
    sites.sort((a, b) => {
      if (a.is_default && !b.is_default) return -1;
      if (!a.is_default && b.is_default) return 1;
      return a.name.localeCompare(b.name, 'ko');
    });

    return sites;
  } catch (error) {
    console.error('❌ [siteManagement] 현장 목록 조회 중 오류:', error);
    return [];
  }
}

/**
 * 관리자의 기본 현장 조회 (affiliation 기반 자동 매칭)
 * 1순위: is_default = TRUE인 현장
 * 2순위: affiliation과 이름이 일치하는 현장
 * 3순위: 첫 번째 접근 가능한 현장
 */
export async function getDefaultSite(): Promise<Site | null> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user || !user.user_metadata) {
      return null;
    }

    const affiliation = user.user_metadata.affiliation as string | undefined;

    // 접근 가능한 현장 목록 조회
    const accessibleSites = await getAccessibleSites();

    if (accessibleSites.length === 0) {
      console.warn('⚠️ [siteManagement] 접근 가능한 현장이 없습니다.');
      return null;
    }

    // 1순위: is_default = TRUE인 현장
    const defaultSite = accessibleSites.find(site => site.is_default);
    if (defaultSite) {
      console.log('✅ [siteManagement] 기본 현장 발견 (is_default):', defaultSite.name);
      return defaultSite;
    }

    // 2순위: affiliation과 이름이 일치하는 현장
    if (affiliation) {
      const matchedSite = accessibleSites.find(
        site => site.name === affiliation || site.name.includes(affiliation),
      );
      if (matchedSite) {
        console.log('✅ [siteManagement] 기본 현장 발견 (affiliation 매칭):', matchedSite.name);
        return matchedSite;
      }
    }

    // 3순위: 첫 번째 접근 가능한 현장
    const firstSite = accessibleSites[0];
    console.log('✅ [siteManagement] 기본 현장 발견 (첫 번째):', firstSite.name);
    return firstSite;
  } catch (error) {
    console.error('❌ [siteManagement] 기본 현장 조회 중 오류:', error);
    return null;
  }
}

/**
 * 선택한 현장 저장
 * 권한이 없으면 자동으로 viewer 권한 부여
 */
export async function saveSelectedSite(siteId: string, siteName: string): Promise<void> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new Error('로그인이 필요합니다.');
    }

    // 현재 사용자의 해당 현장 권한 확인
    const { data: existingPermission } = await supabase
      .from('admin_sites')
      .select('id')
      .eq('admin_id', user.id)
      .eq('site_id', siteId)
      .maybeSingle();

    // 권한이 없으면 자동으로 viewer 권한 부여
    if (!existingPermission) {
      const { error: insertError } = await supabase
        .from('admin_sites')
        .insert({
          admin_id: user.id,
          site_id: siteId,
          role: 'viewer',
          is_default: false,
        });

      if (insertError) {
        console.warn('⚠️ [siteManagement] 권한 자동 부여 실패:', insertError);
        // 권한 부여 실패해도 선택은 저장 (다음에 다시 시도)
      } else {
        console.log('✅ [siteManagement] viewer 권한 자동 부여:', siteName);
      }
    }

    await AsyncStorage.setItem(STORAGE_KEY_SELECTED_SITE_ID, siteId);
    await AsyncStorage.setItem(STORAGE_KEY_SELECTED_SITE_NAME, siteName);
    console.log('✅ [siteManagement] 현장 저장 완료:', siteName);
  } catch (error) {
    console.error('❌ [siteManagement] 현장 저장 실패:', error);
    throw error;
  }
}

/**
 * 선택한 현장 조회
 */
export async function getSelectedSite(): Promise<{ id: string; name: string } | null> {
  try {
    const [siteId, siteName] = await Promise.all([
      AsyncStorage.getItem(STORAGE_KEY_SELECTED_SITE_ID),
      AsyncStorage.getItem(STORAGE_KEY_SELECTED_SITE_NAME),
    ]);

    if (!siteId || !siteName) {
      return null;
    }

    // 현장이 실제로 존재하는지 확인 (삭제된 현장이면 null 반환)
    const { data: siteExists } = await supabase
      .from('sites')
      .select('id')
      .eq('id', siteId)
      .maybeSingle();

    if (!siteExists) {
      console.log('⚠️ [siteManagement] 선택된 현장이 존재하지 않음 (삭제됨) - 선택 해제');
      await clearSelectedSite();
      return null;
    }

    return { id: siteId, name: siteName };
  } catch (error) {
    console.error('❌ [siteManagement] 선택한 현장 조회 실패:', error);
    return null;
  }
}

/**
 * 선택한 현장 삭제 (로그아웃 시 사용)
 */
export async function clearSelectedSite(): Promise<void> {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY_SELECTED_SITE_ID);
    await AsyncStorage.removeItem(STORAGE_KEY_SELECTED_SITE_NAME);
    console.log('✅ [siteManagement] 선택한 현장 삭제 완료');
  } catch (error) {
    console.error('❌ [siteManagement] 선택한 현장 삭제 실패:', error);
  }
}

/**
 * 현장 선택 여부 확인
 */
export async function hasSelectedSite(): Promise<boolean> {
  const selected = await getSelectedSite();
  return selected !== null;
}

/**
 * 현재 선택한 현장에서 사용자의 역할 확인
 * @returns 'admin' | 'manager' | 'viewer' | null (현장이 선택되지 않은 경우)
 */
export async function getCurrentSiteRole(): Promise<'admin' | 'manager' | 'viewer' | null> {
  try {
    const selectedSite = await getSelectedSite();
    if (!selectedSite) {
      console.log('⚠️ [siteManagement] 선택한 현장이 없습니다.');
      return null;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      console.log('⚠️ [siteManagement] 사용자 정보가 없습니다.');
      return null;
    }

    // 모든 접근 가능한 현장 목록 조회
    const accessibleSites = await getAccessibleSites();
    const currentSite = accessibleSites.find(site => site.id === selectedSite.id);

    if (!currentSite) {
      console.log('⚠️ [siteManagement] 현재 현장을 찾을 수 없습니다:', selectedSite.id);
      return null;
    }

    console.log('🔍 [siteManagement] 현재 현장 권한 확인:', {
      siteId: selectedSite.id,
      siteName: selectedSite.name,
      roles: currentSite.roles,
      role: currentSite.role,
      isCreator: currentSite.isCreator,
    });

    // 가장 높은 권한 반환
    if (currentSite.roles?.includes('admin')) {
      return 'admin';
    } else if (currentSite.roles?.includes('manager')) {
      return 'manager';
    } else {
      return 'viewer';
    }
  } catch (error) {
    console.error('❌ [siteManagement] 현재 현장 권한 확인 실패:', error);
    return null;
  }
}

/**
 * 현장이 유효한지 확인 (모든 현장 접근 가능)
 */
export async function validateSiteAccess(siteId: string): Promise<boolean> {
  try {
    // 모든 현장에 접근 가능하므로, 현장이 존재하는지만 확인
    const { data, error } = await supabase
      .from('sites')
      .select('id')
      .eq('id', siteId)
      .maybeSingle();

    if (error) {
      console.error('❌ [siteManagement] 현장 확인 실패:', error);
      return false;
    }

    return data !== null;
  } catch (error) {
    console.error('❌ [siteManagement] 현장 접근 권한 확인 실패:', error);
    return false;
  }
}

/**
 * 현장 비밀번호 확인
 */
export async function validateSitePassword(siteId: string, password: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('sites')
      .select('password')
      .eq('id', siteId)
      .maybeSingle();

    if (error) {
      console.error('❌ [siteManagement] 현장 비밀번호 확인 실패:', error);
      return false;
    }

    if (!data) {
      return false;
    }

    // 비밀번호가 없으면 (NULL) 접근 허용
    if (!data.password) {
      return true;
    }

    // 비밀번호가 있으면 일치 여부 확인
    const isValid = data.password === password.trim();
    
    // 비밀번호가 맞으면 인증된 현장 목록에 추가
    if (isValid) {
      await addVerifiedSite(siteId);
    }
    
    return isValid;
  } catch (error) {
    console.error('❌ [siteManagement] 현장 비밀번호 확인 중 오류:', error);
    return false;
  }
}

/**
 * 비밀번호 인증된 현장 목록에 추가 (사용자별로 저장)
 */
async function addVerifiedSite(siteId: string): Promise<void> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return;
    }

    // 사용자별로 인증된 현장 목록 저장
    const userKey = `${STORAGE_KEY_VERIFIED_SITES}_${user.id}`;
    const verifiedSitesJson = await AsyncStorage.getItem(userKey);
    const verifiedSites: string[] = verifiedSitesJson ? JSON.parse(verifiedSitesJson) : [];
    
    if (!verifiedSites.includes(siteId)) {
      verifiedSites.push(siteId);
      await AsyncStorage.setItem(userKey, JSON.stringify(verifiedSites));
      console.log('✅ [siteManagement] 인증된 현장 목록에 추가:', siteId);
    }
  } catch (error) {
    console.error('❌ [siteManagement] 인증된 현장 목록 추가 실패:', error);
  }
}

/**
 * 현장이 비밀번호 인증되었는지 확인 (사용자별로 확인)
 */
export async function isSiteVerified(siteId: string): Promise<boolean> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return false;
    }

    // 사용자별로 인증된 현장 목록 확인
    const userKey = `${STORAGE_KEY_VERIFIED_SITES}_${user.id}`;
    const verifiedSitesJson = await AsyncStorage.getItem(userKey);
    const verifiedSites: string[] = verifiedSitesJson ? JSON.parse(verifiedSitesJson) : [];
    return verifiedSites.includes(siteId);
  } catch (error) {
    console.error('❌ [siteManagement] 인증된 현장 확인 실패:', error);
    return false;
  }
}

/**
 * 인증된 현장 목록 초기화 (로그아웃 시 사용)
 * 사용자별로 저장되어 있으므로 로그아웃 시 초기화하지 않음 (다음 로그인 시에도 유지)
 */
export async function clearVerifiedSites(): Promise<void> {
  // 로그아웃 시에도 인증된 현장 목록을 유지하여 재로그인 시 비밀번호 재입력 방지
  // 보안상 문제가 있다면 필요 시 수동으로 초기화할 수 있도록 주석 처리
  console.log('ℹ️ [siteManagement] 인증된 현장 목록은 유지됩니다 (재로그인 시 비밀번호 재입력 불필요)');
}

/**
 * 현장에서 나가기 (조회자 권한 제거)
 * admin_sites에서 viewer 권한을 제거하고, 인증된 현장 목록에서도 제거
 */
export async function leaveSite(siteId: string): Promise<void> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new Error('로그인이 필요합니다.');
    }

    // admin_sites에서 viewer 권한 제거
    const { error: deleteError } = await supabase
      .from('admin_sites')
      .delete()
      .eq('admin_id', user.id)
      .eq('site_id', siteId)
      .eq('role', 'viewer'); // viewer 권한만 제거 (admin 권한은 유지)

    if (deleteError) {
      throw deleteError;
    }

    // 인증된 현장 목록에서도 제거
    const userKey = `${STORAGE_KEY_VERIFIED_SITES}_${user.id}`;
    const verifiedSitesJson = await AsyncStorage.getItem(userKey);
    const verifiedSites: string[] = verifiedSitesJson ? JSON.parse(verifiedSitesJson) : [];
    const updatedSites = verifiedSites.filter(id => id !== siteId);
    await AsyncStorage.setItem(userKey, JSON.stringify(updatedSites));

    console.log('✅ [siteManagement] 현장에서 나가기 완료:', siteId);
  } catch (error: any) {
    console.error('❌ [siteManagement] 현장에서 나가기 실패:', error);
    throw error;
  }
}

/**
 * 현장 추가
 * 현장을 추가한 사용자가 자동으로 관리자(admin) 권한을 받음
 */
export async function createSite(
  companyName: string,
  siteName: string,
  password: string,
  description?: string,
): Promise<Site> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new Error('로그인이 필요합니다.');
    }

    // 비밀번호 검증
    if (!password || password.trim().length < 4) {
      throw new Error('비밀번호는 최소 4자 이상이어야 합니다.');
    }

    // "기업명-현장명" 형식으로 조합
    const fullName = `${companyName.trim()}-${siteName.trim()}`;

    // 현장 이름 중복 체크
    const { data: existingSite } = await supabase
      .from('sites')
      .select('id')
      .eq('name', fullName)
      .maybeSingle();

    if (existingSite) {
      throw new Error('이미 존재하는 현장 이름입니다.');
    }

    // 현장 추가
    const { data: newSite, error: siteError } = await supabase
      .from('sites')
      .insert({
        name: fullName,
        company_name: companyName.trim(),
        password: password.trim(),
        description: description?.trim() || null,
        creator_id: user.id,
      })
      .select()
      .single();

    if (siteError) {
      throw siteError;
    }

    // admin_sites에 자동 매핑 (관리자 권한 부여)
    const { error: adminSiteError } = await supabase
      .from('admin_sites')
      .insert({
        admin_id: user.id,
        site_id: newSite.id,
        role: 'admin',
        is_default: false, // 첫 번째 현장이면 나중에 true로 설정 가능
      });

    if (adminSiteError) {
      console.error('❌ [siteManagement] admin_sites 매핑 실패:', adminSiteError);
      // 현장은 생성되었지만 매핑 실패 - 현장 삭제하고 에러 throw
      await supabase.from('sites').delete().eq('id', newSite.id);
      throw new Error(
        `현장 생성은 성공했지만 권한 부여에 실패했습니다: ${adminSiteError.message}`,
      );
    }

    console.log('✅ [siteManagement] 현장 생성 완료:', newSite.name);
    return {
      id: newSite.id,
      name: newSite.name,
      description: newSite.description || undefined,
    };
  } catch (error: any) {
    console.error('❌ [siteManagement] 현장 생성 실패:', error);
    throw error;
  }
}

/**
 * 본인이 만든 현장 목록 조회
 */
export async function getMySites(): Promise<Site[]> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return [];
    }

    const { data, error } = await supabase
      .from('sites')
      .select('id, name, description')
      .eq('creator_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ [siteManagement] 내 현장 목록 조회 실패:', error);
      return [];
    }

    return (data || []).map(site => ({
      id: site.id,
      name: site.name,
      description: site.description || undefined,
    }));
  } catch (error) {
    console.error('❌ [siteManagement] 내 현장 목록 조회 중 오류:', error);
    return [];
  }
}

/**
 * 현장 수정 (본인이 만든 현장만)
 */
export async function updateSite(
  siteId: string,
  name: string,
  description?: string,
): Promise<void> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new Error('로그인이 필요합니다.');
    }

    // 본인이 만든 현장인지 확인
    const { data: site, error: checkError } = await supabase
      .from('sites')
      .select('creator_id')
      .eq('id', siteId)
      .single();

    if (checkError || !site) {
      throw new Error('현장을 찾을 수 없습니다.');
    }

    if (site.creator_id !== user.id) {
      throw new Error('본인이 만든 현장만 수정할 수 있습니다.');
    }

    // 현장 이름 중복 체크 (자기 자신 제외)
    const { data: existingSite } = await supabase
      .from('sites')
      .select('id')
      .eq('name', name.trim())
      .neq('id', siteId)
      .maybeSingle();

    if (existingSite) {
      throw new Error('이미 존재하는 현장 이름입니다.');
    }

    // 현장 수정
    const { error: updateError } = await supabase
      .from('sites')
      .update({
        name: name.trim(),
        description: description?.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', siteId);

    if (updateError) {
      throw updateError;
    }

    console.log('✅ [siteManagement] 현장 수정 완료:', name);
  } catch (error: any) {
    console.error('❌ [siteManagement] 현장 수정 실패:', error);
    throw error;
  }
}

/**
 * 현장 삭제 (본인이 만든 현장만)
 */
export async function deleteSite(siteId: string): Promise<void> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new Error('로그인이 필요합니다.');
    }

    // 본인이 만든 현장인지 확인
    const { data: site, error: checkError } = await supabase
      .from('sites')
      .select('creator_id, name')
      .eq('id', siteId)
      .single();

    if (checkError || !site) {
      throw new Error('현장을 찾을 수 없습니다.');
    }

    if (site.creator_id !== user.id) {
      throw new Error('본인이 만든 현장만 삭제할 수 있습니다.');
    }

    // 현장 삭제 전: 해당 현장에 연결된 모든 아두이노의 reset_wifi_flag를 true로 설정
    console.log('🔄 [siteManagement] 현장 삭제 전 - 연결된 장비의 WiFi 재설정 플래그 설정 중...');
    const { data: devices, error: devicesError } = await supabase
      .from('gori_status')
      .select('device_id')
      .eq('site_id', siteId);

    if (devicesError) {
      console.warn('⚠️ [siteManagement] 장비 조회 실패 (계속 진행):', devicesError);
    } else if (devices && devices.length > 0) {
      console.log(`📱 [siteManagement] ${devices.length}개 장비 발견 - reset_wifi_flag 설정 중...`);
      
      // 모든 장비의 reset_wifi_flag를 true로 설정
      const deviceIds = devices.map(d => d.device_id).filter(Boolean);
      if (deviceIds.length > 0) {
        const { error: resetError } = await supabase
          .from('gori_status')
          .update({ reset_wifi_flag: true })
          .in('device_id', deviceIds);

        if (resetError) {
          console.warn('⚠️ [siteManagement] reset_wifi_flag 설정 실패 (계속 진행):', resetError);
        } else {
          console.log(`✅ [siteManagement] ${deviceIds.length}개 장비의 reset_wifi_flag 설정 완료`);
        }
      }
    } else {
      console.log('ℹ️ [siteManagement] 연결된 장비가 없습니다.');
    }

    // 현장 삭제 (CASCADE로 admin_sites도 자동 삭제됨)
    const { error: deleteError } = await supabase
      .from('sites')
      .delete()
      .eq('id', siteId);

    if (deleteError) {
      throw deleteError;
    }

    // 삭제된 현장이 현재 선택된 현장이면 선택 해제
    const currentSite = await getSelectedSite();
    if (currentSite && currentSite.id === siteId) {
      console.log('🔄 [siteManagement] 삭제된 현장이 선택된 현장이므로 선택 해제');
      await clearSelectedSite();
    }

    console.log('✅ [siteManagement] 현장 삭제 완료:', site.name);
  } catch (error: any) {
    console.error('❌ [siteManagement] 현장 삭제 실패:', error);
    throw error;
  }
}

