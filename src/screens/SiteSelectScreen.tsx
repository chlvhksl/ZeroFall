/**
 * 현장 선택 화면
 * 로그인 후 접근 가능한 현장 목록을 표시하고 선택할 수 있게 함
 */

import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    ActivityIndicator,
    Alert,
    Image,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
// @ts-ignore
import { Ionicons } from '@expo/vector-icons';
import { useFontByLanguage } from '../../lib/fontUtils-safe';
import {
    AccessibleSite,
    clearSelectedSite,
    clearVerifiedSites,
    deleteSite,
    getAccessibleSites,
    getDefaultSite,
    getSelectedSite,
    isSiteVerified,
    leaveSite,
    saveSelectedSite,
    validateSitePassword,
} from '../../lib/siteManagement';
import { supabase } from '../../lib/supabase';

// 이미지 import
import LogoutImage from '../../assets/logout.png';

// 폰트는 useFontByLanguage 훅으로 동적으로 가져옵니다

export default function SiteSelectScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const fonts = useFontByLanguage();
  const [loading, setLoading] = useState(true);
  const [sites, setSites] = useState<AccessibleSite[]>([]);
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);
  const [passwordModalVisible, setPasswordModalVisible] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [pendingSite, setPendingSite] = useState<AccessibleSite | null>(null);
  const [deleteMode, setDeleteMode] = useState(false);
  const [selectedSitesForDelete, setSelectedSitesForDelete] = useState<Set<string>>(new Set());
  const [leaveMode, setLeaveMode] = useState(false);
  const [selectedSitesForLeave, setSelectedSitesForLeave] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');

  // 현장 목록 로드
  useEffect(() => {
    loadSites();
  }, []);

  // 화면 포커스 시 현장 목록 다시 로드 (현장 추가 후 반영)
  useFocusEffect(
    useCallback(() => {
      loadSites();
    }, []),
  );

  const loadSites = async () => {
    try {
      setLoading(true);
      const accessibleSites = await getAccessibleSites();

      if (accessibleSites.length === 0) {
        // 현장이 없어도 화면은 표시하고, 현장 추가를 유도
        setSites([]);
        setLoading(false);
        return;
      }

      setSites(accessibleSites);

      // 디버깅: 본인이 만든 현장 확인
      const mySites = accessibleSites.filter(site => site.isCreator);
      console.log('✅ [SiteSelectScreen] 본인이 만든 현장:', mySites.length, '개');
      if (mySites.length > 0) {
        console.log('✅ [SiteSelectScreen] 현장 목록:', mySites.map(s => s.name));
      }

      // 현재 선택한 현장 확인
      const currentSelectedSite = await getSelectedSite();
      if (currentSelectedSite) {
        // 현재 선택한 현장이 접근 가능한 현장 목록에 있는지 확인
        const isAccessible = accessibleSites.some(
          site => site.id === currentSelectedSite.id,
        );
        if (isAccessible) {
          setSelectedSiteId(currentSelectedSite.id);
        } else {
          // 현재 선택한 현장이 접근 불가능하면 기본 현장 선택
          const defaultSite = await getDefaultSite();
          if (defaultSite) {
            setSelectedSiteId(defaultSite.id);
          }
        }
      } else {
        // 선택한 현장이 없으면 기본 현장 자동 선택
        const defaultSite = await getDefaultSite();
        if (defaultSite) {
          setSelectedSiteId(defaultSite.id);
        }
      }
    } catch (error: any) {
      console.error('❌ [SiteSelectScreen] 현장 목록 로드 실패:', error);
      console.error('❌ [SiteSelectScreen] 에러 상세:', JSON.stringify(error, null, 2));
      
      // 에러가 발생해도 화면은 표시 (빈 목록으로)
      setSites([]);
      
      // 에러 메시지 표시하지 않음 (getAccessibleSites에서 이미 빈 배열 반환)
      // 사용자는 현장 추가 버튼을 통해 현장을 추가할 수 있음
    } finally {
      setLoading(false);
    }
  };

  // 현장 선택 및 저장
  const handleSelectSite = async (site: AccessibleSite) => {
    try {
      // 1. 관리자(admin) 권한이 있으면 비밀번호 확인 없이 바로 선택
      const hasAdminRole = site.roles?.includes('admin') || site.role === 'admin';
      if (hasAdminRole) {
        await proceedWithSiteSelection(site);
        return;
      }

      // 2. 비밀번호가 있는 현장인 경우 비밀번호 확인
      if (site.hasPassword) {
        // 이미 인증된 현장인지 확인 (조회자가 한 번 입력한 현장)
        const isVerified = await isSiteVerified(site.id);
        if (isVerified) {
          // 이미 인증된 현장이면 비밀번호 입력 없이 바로 선택
          await proceedWithSiteSelection(site);
          return;
        }

        // 인증되지 않은 현장이면 비밀번호 입력 요청
        if (Platform.OS === 'ios') {
          // iOS: Alert.prompt 사용
          Alert.prompt(
            t('siteSelect.enterPassword'),
            t('siteSelect.enterPasswordForSite', { name: site.name }),
            [
              {
                text: t('common.cancel'),
                style: 'cancel',
              },
              {
                text: t('common.confirm'),
                onPress: async (password?: string) => {
                  if (!password) {
                    Alert.alert(t('common.error'), t('siteSelect.passwordRequired'));
                    return;
                  }
                  await verifyAndSelectSite(site, password);
                },
              },
            ],
            'secure-text',
          );
        } else {
          // Android: 모달 사용
          setPendingSite(site);
          setPasswordInput('');
          setPasswordModalVisible(true);
        }
      } else {
        // 비밀번호가 없는 현장은 바로 선택
        await proceedWithSiteSelection(site);
      }
    } catch (error) {
      console.error('❌ [SiteSelectScreen] 현장 선택 실패:', error);
      Alert.alert(t('common.error'), t('siteSelect.selectError'));
    }
  };

  // 비밀번호 확인 후 현장 선택
  const verifyAndSelectSite = async (site: AccessibleSite, password: string) => {
    try {
      const isValid = await validateSitePassword(site.id, password);
      if (!isValid) {
        Alert.alert(t('common.error'), t('siteSelect.passwordIncorrect'));
        return;
      }
      await proceedWithSiteSelection(site);
    } catch (error) {
      console.error('❌ [SiteSelectScreen] 비밀번호 확인 실패:', error);
      Alert.alert(t('common.error'), t('siteSelect.passwordError'));
    }
  };

  // 현장 선택 진행
  const proceedWithSiteSelection = async (site: AccessibleSite) => {
    try {
      console.log('✅ [SiteSelectScreen] 현장 선택 시작:', site.name);
      setSelectedSiteId(site.id);
      await saveSelectedSite(site.id, site.name);
      
      // 현장 선택 후 무조건 메인 화면으로 이동 (이전 화면으로 돌아가지 않음)
      console.log('➡️ [SiteSelectScreen] 라우팅: /main (현장 선택 완료)');
      router.replace('/main');
    } catch (error) {
      console.error('❌ [SiteSelectScreen] 현장 선택 실패:', error);
      Alert.alert(t('common.error'), t('siteSelect.selectError'));
    }
  };

  // Android 모달에서 비밀번호 확인
  const handlePasswordModalConfirm = async () => {
    if (!passwordInput.trim()) {
      Alert.alert(t('common.error'), t('siteSelect.passwordRequired'));
      return;
    }

    if (!pendingSite) {
      return;
    }

    setPasswordModalVisible(false);
    await verifyAndSelectSite(pendingSite, passwordInput);
    setPasswordInput('');
    setPendingSite(null);
  };

  // 개별 현장 삭제
  const handleSingleDelete = async (site: AccessibleSite) => {
    Alert.alert(
      t('siteSelect.deleteSite'),
      t('siteSelect.deleteConfirm', { name: site.name }),
      [
        {
          text: t('common.cancel'),
          style: 'cancel',
        },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteSite(site.id);
              Alert.alert(t('common.success'), t('siteSelect.siteDeleted'));
              // 현장 목록 새로고침
              loadSites();
            } catch (error: any) {
              console.error('❌ [SiteSelectScreen] 현장 삭제 실패:', error);
              Alert.alert(t('common.error'), error.message || t('siteSelect.deleteError'));
            }
          },
        },
      ],
    );
  };

  // 현장에서 나가기 (조회자 권한 제거)
  const handleLeaveSite = async (site: AccessibleSite) => {
    Alert.alert(
      t('siteSelect.leaveSite'),
      t('siteSelect.leaveConfirm', { name: site.name }),
      [
        {
          text: t('common.cancel'),
          style: 'cancel',
        },
        {
          text: t('siteSelect.leave'),
          style: 'destructive',
          onPress: async () => {
            try {
              await leaveSite(site.id);
              
              // 현재 선택한 현장이면 선택 해제
              const currentSelected = await getSelectedSite();
              if (currentSelected && currentSelected.id === site.id) {
                await clearSelectedSite();
              }
              
              Alert.alert(t('common.success'), t('siteSelect.siteLeft'));
              // 현장 목록 새로고침
              loadSites();
            } catch (error: any) {
              console.error('❌ [SiteSelectScreen] 현장 나가기 실패:', error);
              Alert.alert(t('common.error'), error.message || t('siteSelect.leaveError'));
            }
          },
        },
      ],
    );
  };

  // 삭제 모드 토글
  const toggleDeleteMode = () => {
    setDeleteMode(!deleteMode);
    setSelectedSitesForDelete(new Set());
    // 나가기 모드와 동시에 활성화 불가
    if (!deleteMode) {
      setLeaveMode(false);
      setSelectedSitesForLeave(new Set());
    }
  };

  // 나가기 모드 토글
  const toggleLeaveMode = () => {
    setLeaveMode(!leaveMode);
    setSelectedSitesForLeave(new Set());
    // 삭제 모드와 동시에 활성화 불가
    if (!leaveMode) {
      setDeleteMode(false);
      setSelectedSitesForDelete(new Set());
    }
  };

  // 나갈 현장 선택/해제
  const toggleSiteForLeave = (siteId: string) => {
    const newSelected = new Set(selectedSitesForLeave);
    if (newSelected.has(siteId)) {
      newSelected.delete(siteId);
    } else {
      newSelected.add(siteId);
    }
    setSelectedSitesForLeave(newSelected);
  };

  // 선택한 현장들 한꺼번에 나가기
  const handleBatchLeave = async () => {
    if (selectedSitesForLeave.size === 0) {
      Alert.alert(t('common.error'), t('siteSelect.selectLeaveError'));
      return;
    }

    const selectedCount = selectedSitesForLeave.size;
    const siteNames = sites
      .filter(site => selectedSitesForLeave.has(site.id))
      .map(site => site.name)
      .join(', ');

    Alert.alert(
      t('siteSelect.leaveSite'),
      t('siteSelect.batchLeaveConfirm', { count: selectedCount, names: siteNames }),
      [
        {
          text: t('common.cancel'),
          style: 'cancel',
        },
        {
          text: t('siteSelect.leaveSite'),
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              const leavePromises = Array.from(selectedSitesForLeave).map(siteId =>
                leaveSite(siteId).catch(error => {
                  console.error(`❌ [SiteSelectScreen] 현장 나가기 실패 (${siteId}):`, error);
                  return { error, siteId };
                })
              );

              const results = await Promise.all(leavePromises);
              const errors = results.filter(r => r && 'error' in r);

              if (errors.length > 0) {
                Alert.alert(
                  t('siteSelect.leavePartialError'),
                  t('siteSelect.leavePartialMessage', { success: selectedCount - errors.length, failed: errors.length }),
                );
              } else {
                Alert.alert(t('common.success'), t('siteSelect.leaveSuccess', { count: selectedCount }));
              }

              // 현재 선택한 현장이 나간 현장 중 하나면 선택 해제
              const currentSelected = await getSelectedSite();
              if (currentSelected && selectedSitesForLeave.has(currentSelected.id)) {
                await clearSelectedSite();
              }

              // 나가기 모드 종료 및 목록 새로고침
              setLeaveMode(false);
              setSelectedSitesForLeave(new Set());
              loadSites();
            } catch (error: any) {
              console.error('❌ [SiteSelectScreen] 일괄 나가기 실패:', error);
              Alert.alert(t('common.error'), t('siteSelect.leaveError'));
              setLoading(false);
            }
          },
        },
      ],
    );
  };

  // 삭제할 현장 선택/해제
  const toggleSiteForDelete = (siteId: string) => {
    const newSelected = new Set(selectedSitesForDelete);
    if (newSelected.has(siteId)) {
      newSelected.delete(siteId);
    } else {
      newSelected.add(siteId);
    }
    setSelectedSitesForDelete(newSelected);
  };

  // 선택한 현장들 한꺼번에 삭제
  const handleBatchDelete = async () => {
    if (selectedSitesForDelete.size === 0) {
      Alert.alert(t('common.error'), t('siteSelect.selectDeleteError'));
      return;
    }

    const selectedCount = selectedSitesForDelete.size;
    const siteNames = sites
      .filter(site => selectedSitesForDelete.has(site.id))
      .map(site => site.name)
      .join(', ');

    Alert.alert(
      t('siteSelect.deleteSite'),
      t('siteSelect.batchDeleteConfirm', { count: selectedCount, names: siteNames }),
      [
        {
          text: t('common.cancel'),
          style: 'cancel',
        },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              const deletePromises = Array.from(selectedSitesForDelete).map(siteId =>
                deleteSite(siteId).catch(error => {
                  console.error(`❌ [SiteSelectScreen] 현장 삭제 실패 (${siteId}):`, error);
                  return { error, siteId };
                })
              );

              const results = await Promise.all(deletePromises);
              const errors = results.filter(r => r && 'error' in r);

              if (errors.length > 0) {
                Alert.alert(
                  '일부 삭제 실패',
                  `${selectedCount - errors.length}개는 삭제되었지만, ${errors.length}개는 삭제에 실패했습니다.`,
                );
              } else {
                Alert.alert(t('common.success'), t('siteSelect.deleteSuccess', { count: selectedCount }));
              }

              // 삭제 모드 종료 및 목록 새로고침
              setDeleteMode(false);
              setSelectedSitesForDelete(new Set());
              loadSites();
            } catch (error: any) {
              console.error('❌ [SiteSelectScreen] 일괄 삭제 실패:', error);
              Alert.alert(t('common.error'), t('siteSelect.deleteError'));
              setLoading(false);
            }
          },
        },
      ],
    );
  };

  // 로그아웃 처리
  const handleLogout = () => {
    Alert.alert(t('main.logout'), t('main.logoutConfirm'), [
      {
        text: t('common.cancel'),
        style: 'cancel',
      },
      {
        text: t('common.yes'),
        onPress: async () => {
          try {
            // 인증된 현장 목록 초기화
            await clearVerifiedSites();
            
            const { error } = await supabase.auth.signOut();
            if (error) {
              Alert.alert(t('common.error'), t('main.logoutError'));
            } else {
              router.replace('/signin');
            }
          } catch (error) {
            console.error('로그아웃 에러:', error);
            Alert.alert(t('common.error'), t('main.logoutError'));
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={[styles.loadingText, { fontFamily: fonts.regular }]}>{t('siteSelect.loading')}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* 상단 헤더 */}
      <View style={styles.topHeader}>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
          <Image source={LogoutImage} style={styles.logoutIcon} />
        </TouchableOpacity>
        <View style={styles.actionButtonsContainer}>
          {sites.some(site => site.isCreator) && (
            <TouchableOpacity
              onPress={toggleDeleteMode}
              style={[styles.actionModeButton, deleteMode && styles.deleteModeButtonActive]}
            >
              <Ionicons
                name={deleteMode ? 'close-circle' : 'trash-outline'}
                size={24}
                color={deleteMode ? '#FF3B30' : '#000'}
              />
              <Text style={[styles.actionModeButtonText, deleteMode && styles.actionModeButtonTextActive]}>
                {deleteMode ? t('common.cancel') : t('siteSelect.deleteSite')}
              </Text>
            </TouchableOpacity>
          )}
          {sites.some(site => !site.isCreator && site.roles?.includes('viewer')) && (
            <TouchableOpacity
              onPress={toggleLeaveMode}
              style={[styles.actionModeButton, leaveMode && styles.leaveModeButtonActive]}
            >
              <Ionicons
                name={leaveMode ? 'close-circle' : 'exit-outline'}
                size={24}
                color={leaveMode ? '#FF9500' : '#000'}
              />
              <Text style={[styles.actionModeButtonText, leaveMode && styles.leaveModeButtonTextActive]}>
                {leaveMode ? t('common.cancel') : t('siteSelect.leaveSite')}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        {/* 헤더 */}
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>{t('siteSelect.title')}</Text>
            <TouchableOpacity
              style={styles.addButtonHeader}
              onPress={() => router.push('/add-site')}
            >
              <Ionicons name="add" size={20} color="#FFF" />
              <Text style={[styles.addButtonHeaderText, { fontFamily: fonts.bold }]}>{t('siteSelect.addSite')}</Text>
            </TouchableOpacity>
          </View>
          <Text style={[styles.subtitle, { fontFamily: fonts.regular }]}>
            {t('siteSelect.subtitle')}
          </Text>
        </View>

        {/* 검색창 */}
        <View style={styles.searchContainer}>
          <Ionicons name="search-outline" size={20} color="#666" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder={t('siteSelect.searchPlaceholder')}
            placeholderTextColor="#999"
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearchQuery('')}
              style={styles.clearButton}
            >
              <Ionicons name="close-circle" size={20} color="#666" />
            </TouchableOpacity>
          )}
        </View>

        {/* 현장이 없을 때 안내 메시지 */}
        {sites.length === 0 && (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyTitle}>{t('siteSelect.noSites')}</Text>
            <Text style={styles.emptyText}>
              {t('siteSelect.addSiteToStart')}
            </Text>
            <Text style={styles.emptySubtext}>
              {t('siteSelect.addSiteAdminInfo')}
            </Text>
          </View>
        )}

        {/* 현장 목록 */}
        <View style={styles.sitesContainer}>
          {sites
            .filter(site => {
              if (!searchQuery.trim()) return true;
              const query = searchQuery.trim().toLowerCase();
              return (
                site.name.toLowerCase().includes(query) ||
                (site.description && site.description.toLowerCase().includes(query))
              );
            })
            .map(site => {
            const isSelected = selectedSiteId === site.id;
            const isDefault = site.is_default;

            const isSelectedForDelete = selectedSitesForDelete.has(site.id);
            const isSelectedForLeave = selectedSitesForLeave.has(site.id);
            const canDelete = site.isCreator;
            const canLeave = !site.isCreator && site.roles?.includes('viewer');

            return (
              <TouchableOpacity
                key={site.id}
                style={[
                  styles.siteCard,
                  isSelected && !deleteMode && !leaveMode && styles.siteCardSelected,
                  deleteMode && canDelete && isSelectedForDelete && styles.siteCardSelectedForDelete,
                  leaveMode && canLeave && isSelectedForLeave && styles.siteCardSelectedForLeave,
                  (deleteMode && !canDelete) || (leaveMode && !canLeave) ? styles.siteCardDisabled : null,
                ]}
                onPress={() => {
                  if (deleteMode) {
                    if (canDelete) {
                      toggleSiteForDelete(site.id);
                    }
                  } else if (leaveMode) {
                    if (canLeave) {
                      toggleSiteForLeave(site.id);
                    }
                  } else {
                    handleSelectSite(site);
                  }
                }}
                disabled={(deleteMode && !canDelete) || (leaveMode && !canLeave)}
              >
                {deleteMode && canDelete && (
                  <View style={styles.checkboxContainer}>
                    <View
                      style={[
                        styles.checkbox,
                        isSelectedForDelete && styles.checkboxChecked,
                      ]}
                    >
                      {isSelectedForDelete && (
                        <Ionicons name="checkmark" size={16} color="#FFF" />
                      )}
                    </View>
                  </View>
                )}
                {leaveMode && canLeave && (
                  <View style={styles.checkboxContainer}>
                    <View
                      style={[
                        styles.checkbox,
                        styles.checkboxLeave,
                        isSelectedForLeave && styles.checkboxCheckedLeave,
                      ]}
                    >
                      {isSelectedForLeave && (
                        <Ionicons name="checkmark" size={16} color="#FFF" />
                      )}
                    </View>
                  </View>
                )}
                <View style={styles.siteCardContent}>
                  <View style={styles.siteCardHeader}>
                    <Text style={styles.siteName}>{site.name}</Text>
                    {isDefault && (
                      <View style={styles.defaultBadge}>
                        <Text style={styles.defaultBadgeText}>{t('siteSelect.default')}</Text>
                      </View>
                    )}
                    {site.role && (
                      <View style={styles.roleBadge}>
                        <Text style={styles.roleBadgeText}>
                          {site.role === 'admin'
                            ? t('siteSelect.admin')
                            : site.role === 'manager'
                              ? t('siteSelect.manager')
                              : t('siteSelect.viewer')}
                        </Text>
                      </View>
                    )}
                  </View>
                  {site.description && (
                    <Text style={styles.siteDescription}>{site.description}</Text>
                  )}
                </View>
                {!deleteMode && !leaveMode && isSelected && (
                  <Ionicons name="checkmark-circle" size={24} color="#007AFF" />
                )}
              </TouchableOpacity>
            );
          })}
          {sites.length > 0 && searchQuery.trim() && sites.filter(site => {
            const query = searchQuery.trim().toLowerCase();
            return (
              site.name.toLowerCase().includes(query) ||
              (site.description && site.description.toLowerCase().includes(query))
            );
          }).length === 0 && (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyTitle}>{t('siteSelect.noSearchResults')}</Text>
              <Text style={styles.emptyText}>
                {t('siteSelect.tryDifferentSearch')}
              </Text>
            </View>
          )}
        </View>

        {/* 안내 문구 */}
        <View style={styles.infoContainer}>
          <Text style={styles.infoText}>
            💡 {t('siteSelect.selectSiteInfo')}
          </Text>
          <Text style={styles.infoText}>
            {t('siteSelect.changeSiteInfo')}
          </Text>
        </View>
      </ScrollView>

      {/* 하단 버튼 영역 */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 20 }]}>
        {deleteMode ? (
          <TouchableOpacity
            style={[
              styles.deleteSelectedButton,
              selectedSitesForDelete.size === 0 && styles.deleteSelectedButtonDisabled,
            ]}
            onPress={handleBatchDelete}
            disabled={selectedSitesForDelete.size === 0}
          >
            <Ionicons name="trash" size={24} color="#FFF" />
            <Text style={styles.deleteSelectedButtonText}>
              {t('siteSelect.deleteSelected', { count: selectedSitesForDelete.size })}
            </Text>
          </TouchableOpacity>
        ) : leaveMode ? (
          <TouchableOpacity
            style={[
              styles.leaveSelectedButton,
              selectedSitesForLeave.size === 0 && styles.leaveSelectedButtonDisabled,
            ]}
            onPress={handleBatchLeave}
            disabled={selectedSitesForLeave.size === 0}
          >
            <Ionicons name="exit" size={24} color="#FFF" />
            <Text style={styles.leaveSelectedButtonText}>
              {t('siteSelect.leaveSelected', { count: selectedSitesForLeave.size })}
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Android 비밀번호 입력 모달 */}
      <Modal
        visible={passwordModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setPasswordModalVisible(false);
          setPasswordInput('');
          setPendingSite(null);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{t('siteSelect.enterPassword')}</Text>
            <Text style={styles.modalSubtitle}>
              {pendingSite ? t('siteSelect.enterPasswordForSite', { name: pendingSite.name }) : ''}
            </Text>
            <TextInput
              style={[styles.modalInput, { fontFamily: undefined }]}
              value={passwordInput}
              onChangeText={setPasswordInput}
              placeholder={t('siteSelect.password')}
              placeholderTextColor="#999"
              secureTextEntry
              autoFocus
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => {
                  setPasswordModalVisible(false);
                  setPasswordInput('');
                  setPendingSite(null);
                }}
              >
                <Text style={styles.modalButtonCancelText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonConfirm]}
                onPress={handlePasswordModalConfirm}
              >
                <Text style={styles.modalButtonConfirmText}>{t('common.confirm')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#EDF6EF',
  },
  topHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  logoutButton: {
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionButtonsContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  actionModeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#000',
    backgroundColor: '#FFF',
    gap: 6,
  },
  deleteModeButtonActive: {
    borderColor: '#FF3B30',
    backgroundColor: '#FFEBEE',
  },
  leaveModeButtonActive: {
    borderColor: '#FF9500',
    backgroundColor: '#FFF8E1',
  },
  actionModeButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000',
  },
  actionModeButtonTextActive: {
    color: '#FF3B30',
  },
  leaveModeButtonTextActive: {
    color: '#FF9500',
  },
  logoutIcon: {
    width: 40,
    height: 40,
    resizeMode: 'contain',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#EDF6EF',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
      },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40, // 하단 여백
  },
  header: {
    marginBottom: 30,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#000',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 16,
  },
  addButtonHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#78C4B4',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#000',
    paddingVertical: 8,
    paddingHorizontal: 12,
    gap: 4,
  },
  addButtonHeaderText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FFF',
      },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#000',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 20,
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#000',
        padding: 0,
  },
  clearButton: {
    marginLeft: 8,
    padding: 4,
  },
  sitesContainer: {
    marginBottom: 30,
  },
  siteCardWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  siteCard: {
    flex: 1,
    backgroundColor: '#FFF',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#000',
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  siteCardSelected: {
    borderColor: '#007AFF',
    borderWidth: 3,
    backgroundColor: '#F0F8FF',
  },
  siteCardSelectedForDelete: {
    borderColor: '#FF3B30',
    backgroundColor: '#FFEBEE',
  },
  siteCardSelectedForLeave: {
    borderColor: '#FF9500',
    backgroundColor: '#FFF8E1',
  },
  siteCardDisabled: {
    opacity: 0.5,
  },
  checkboxContainer: {
    marginRight: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#000',
    backgroundColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#FF3B30',
    borderColor: '#FF3B30',
  },
  checkboxLeave: {
    borderColor: '#FF9500',
  },
  checkboxCheckedLeave: {
    backgroundColor: '#FF9500',
    borderColor: '#FF9500',
  },
  siteCardContent: {
    flex: 1,
  },
  siteCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    flexWrap: 'wrap',
  },
  siteName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000',
        marginRight: 8,
  },
  defaultBadge: {
    backgroundColor: '#FFD700',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginRight: 8,
  },
  defaultBadgeText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#000',
      },
  roleBadge: {
    backgroundColor: '#E0E0E0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  roleBadgeText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#666',
      },
  siteDescription: {
    fontSize: 14,
    color: '#666',
        marginTop: 4,
  },
  deleteButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
    backgroundColor: '#FFF',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#FF3B30',
  },
  leaveButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
    backgroundColor: '#FFF',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#FF9500',
  },
  deleteSelectedButton: {
    backgroundColor: '#FF3B30',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#000',
    padding: 18,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  deleteSelectedButtonDisabled: {
    backgroundColor: '#CCC',
    borderColor: '#999',
  },
  deleteSelectedButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFF',
      },
  leaveSelectedButton: {
    backgroundColor: '#FF9500',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#000',
    padding: 18,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  leaveSelectedButtonDisabled: {
    backgroundColor: '#CCC',
    borderColor: '#999',
  },
  leaveSelectedButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFF',
      },
  infoContainer: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#000',
    padding: 16,
  },
  infoText: {
    fontSize: 14,
    color: '#666',
        marginBottom: 8,
    lineHeight: 20,
  },
  emptyContainer: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#000',
    padding: 30,
    marginBottom: 30,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000',
        marginBottom: 12,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
        textAlign: 'center',
    marginBottom: 8,
    lineHeight: 24,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
        textAlign: 'center',
    lineHeight: 20,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#EDF6EF',
    borderTopWidth: 2,
    borderTopColor: '#000',
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#78C4B4',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#000',
    padding: 16,
    gap: 8,
  },
  addButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFF',
        marginLeft: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 24,
    width: '80%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000',
        marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#666',
        marginBottom: 20,
  },
  modalInput: {
    borderWidth: 2,
    borderColor: '#000',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
        backgroundColor: '#FFF',
    color: '#000',
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  modalButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    minWidth: 80,
    alignItems: 'center',
  },
  modalButtonCancel: {
    backgroundColor: '#FFF',
    borderWidth: 2,
    borderColor: '#000',
  },
  modalButtonConfirm: {
    backgroundColor: '#007AFF',
    borderWidth: 2,
    borderColor: '#000',
  },
  modalButtonCancelText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000',
      },
  modalButtonConfirmText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFF',
      },
});

