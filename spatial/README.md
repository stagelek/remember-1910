# QR 자동 배치 + 공간 추적 · 2026-11-10

관람객 테스트: https://stagelek.github.io/remember-1910/spatial/?content=card
관리자 조정: https://stagelek.github.io/remember-1910/spatial/?content=card&admin=1
content: flower, stairs, card, women, brothers
기존 5종 운영 경로/QR는 변경하지 않았음. 실제 휴대폰 검증 전 테스트 경로만 변경.

## 관람객
시작 → 카메라/센서 허용 → 현장 QR 전체 다시 비추기 → 자동 배치 → 둘러보기.
수동 배치/바닥 선택/크기 조정은 관람객에게 표시하지 않음.
QR 주소 내용 확인 + 같은 QR 이미지의 안정된 위치·방향 관측 4회 후 자동 확정.
QR을 벗어나도 확정된 좌표를 SLAM 공간에 유지. QR 상실 이벤트는 콘텐츠를 숨기지 않음.
SLAM이 LIMITED/상실 상태가 되면 오래된 앵커 폐기 후 QR 재인식. 잘못된 위치에 무조건 고정하지 않음.
터치하면 종료/QR 다시 인식 메뉴, 잠시 뒤 자동 숨김.

## 관리자: 현장에서 한 번 조정
1. QR을 움직이지 않는 위치에 똑바로 세워 부착. 꽃밭도 수직 QR 거치대/벽을 사용.
2. 관리자 주소로 열어 QR 인식.
3. QR 전체 인쇄 폭(흰 여백 포함)을 입력. 기존 A3 PDF QR는 0.058m, A4 PDF는 0.045m. 다른 출력은 반드시 실측.
4. 전체 폭, 좌우, 높이, 앞뒤, 방향 조정. QR 폭을 바꾸면 QR 다시 인식.
5. '관리자 임시 저장'은 해당 기기에만 저장.
6. '관람객 공통 설정 내보내기'로 profiles.json 다운로드.
7. 그 파일의 해당 콘텐츠 설정을 검토 후 서버 spatial/profiles.json에 반영/배포해야 관람객 모두에게 적용됨.
   GitHub Pages는 정적 호스팅이므로 브라우저에서 서버 파일에 직접 쓰지 않음. 관리자 모드는 원격 쓰기 권한을 주지 않음.
8. 관람객은 서버 공통 설정을 읽고 QR로 자동 배치. 관람객 localStorage나 임의 profile 쿼리는 무시.
9. QR 위치/방향/인쇄 크기를 변경하면 해당 콘텐츠 재보정.

위치값은 QR 중심 기준. x+는 QR 오른쪽, y+는 위, z+는 QR의 뒤쪽(설치 공간 안쪽). 단위 m.
전체 폭 기준으로 기존 모델을 균등 확대/축소. 바닥 모델은 발/최저점을 y=0으로 정규화.
QR 상대 앵커는 인식 시 scale×scaledWidth/실물 QR 폭으로 보정해 고정.
꽃밭은 수평 바닥 방향을 복원해 유지. 기존 모델의 곡률/6인 상대 간격/텍스처는 수정하지 않음.

## 현장 정렬 상태
현재 profiles.json의 5종은 calibrated:false. 위치/크기를 실측·정렬한 상태가 아님.
초기값은 QR 중심에서 시작하는 테스트 배치이며 실제 벽/바닥에 맞지 않을 수 있음.
관리자 현장 보정 후 공통 설정을 배포하고 calibrated:true로 전환해야 최종 운영 가능.
현장 검증 후 기존 QR 주소가 이 방식으로 연결되도록 전환할 수 있음. 현재 기존 QR는 종전 이미지 AR로 연결.

## 구현과 검증
- 기본: 무료 자체 호스팅 @8thwall/engine-binary 1.0.0 SLAM + 이미지 타깃.
- 타깃: 공식 MIT @8thwall/image-target-cli 1.0.0로 기존 QR PNG 전체를 PLANAR 타깃으로 생성.
- jsQR 1.4.0 (Apache-2.0)으로 주소 확인. 픽셀은 기기에서 처리, 별도 서버 업로드 기능 없음.
- 5종 QR 원본/회색 타깃에서 두 각도로 주소 디코딩 20개 검사 통과.
- 모의 테스트: 잘못된 QR 거부, 4회 안정 관측, QR 상실 후 유지, SLAM 상실 후 재인식, 공통 설정 우선, 5종 자동 배치/종료 통과.
- 실제 Chrome: 엔진 로드, 관람객 배치 버튼 미노출, 관리자 QR 폭/공통 설정 내보내기 항목, 카드 3D 미리보기/종료 확인.
- 실제 휴대폰의 QR 이미지 위치 인식 성공률, 카메라-QR-공간 정합, 드리프트, 어두운/반사/야외 환경은 미검증.
- GPS/VPS/장소 지도/영구 공유 앵커는 사용하지 않음. 세션마다 고정 QR로 공통 기준 재확립.
- 실물 문·사람·벽에 의한 가림, 방 경계 자동 잘라내기는 미구현.

공식 엔진 배포본은 수정하지 않음. XR Engine License Agreement 적용, MIT SLAM 아님.
Niantic Spatial 저작권/라이선스/무보증 고지는 시작 화면 및 메뉴에 표시.
공식 문서: https://8thwall.org/docs/api/engine/xrcontroller/pipelinemodule
공식 도구: https://github.com/8thwall/8thwall/tree/main/apps/image-target-cli
SDK 구독/가입/API키/유료 서비스는 사용하지 않음.
