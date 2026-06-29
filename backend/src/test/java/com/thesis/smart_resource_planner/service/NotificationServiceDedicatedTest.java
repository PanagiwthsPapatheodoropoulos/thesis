package com.thesis.smart_resource_planner.service;

import com.thesis.smart_resource_planner.enums.NotificationSeverity;
import com.thesis.smart_resource_planner.enums.NotificationType;
import com.thesis.smart_resource_planner.exception.ResourceNotFoundException;
import com.thesis.smart_resource_planner.model.dto.NotificationCreateDTO;
import com.thesis.smart_resource_planner.model.dto.NotificationDTO;
import com.thesis.smart_resource_planner.model.entity.Company;
import com.thesis.smart_resource_planner.model.entity.Notification;
import com.thesis.smart_resource_planner.model.entity.User;
import com.thesis.smart_resource_planner.repository.NotificationRepository;
import com.thesis.smart_resource_planner.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;
import org.modelmapper.ModelMapper;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDateTime;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("NotificationService Tests")
class NotificationServiceDedicatedTest {

    @Spy
    private NotificationRepository notificationRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private ModelMapper modelMapper;

    @Mock
    private SimpMessagingTemplate messagingTemplate;

    @Mock
    private WebSocketBroadcastService broadcastService;

    @InjectMocks
    private NotificationService notificationService;

    private Notification testNotification;
    private NotificationDTO testNotificationDTO;
    private UUID notificationId;
    private UUID userId;
    private User user;

    @BeforeEach
    void setUp() {
        notificationId = UUID.randomUUID();
        userId = UUID.randomUUID();

        user = new User();
        user.setId(userId);
        Company company = new Company();
        company.setId(UUID.randomUUID());
        user.setCompany(company);

        testNotification = new Notification();
        testNotification.setId(notificationId);
        testNotification.setTitle("Test Notification");
        testNotification.setMessage("This is a test notification");
        testNotification.setSeverity(NotificationSeverity.INFO);
        testNotification.setCreatedAt(LocalDateTime.now());
        testNotification.setUser(user);

        testNotificationDTO = new NotificationDTO();
        testNotificationDTO.setId(notificationId);
        testNotificationDTO.setTitle("Test Notification");
        testNotificationDTO.setMessage("This is a test notification");
        testNotificationDTO.setType(NotificationType.TASK_ASSIGNED);
        ReflectionTestUtils.setField(notificationService, "self", notificationService);
    }

    @Test
    @DisplayName("Should retrieve notification by ID successfully")
    void testGetNotificationById_Success() {
        when(notificationRepository.findById(notificationId)).thenReturn(Optional.of(testNotification));
        when(modelMapper.map(testNotification, NotificationDTO.class)).thenReturn(testNotificationDTO);

        NotificationDTO result = notificationService.getNotificationById(notificationId);

        assertNotNull(result);
        assertEquals(testNotificationDTO.getId(), result.getId());
        verify(notificationRepository, times(1)).findById(notificationId);
    }

    @Test
    @DisplayName("Should throw exception when notification not found")
    void testGetNotificationById_NotFound() {
        when(notificationRepository.findById(notificationId)).thenReturn(Optional.empty());

        assertThrows(ResourceNotFoundException.class, () -> notificationService.getNotificationById(notificationId));
    }

    @Test
    @DisplayName("Should create notification successfully")
    void testCreateNotification_Success() {
        NotificationCreateDTO createDTO = new NotificationCreateDTO();
        createDTO.setUserId(userId);
        createDTO.setType(NotificationType.TASK_ASSIGNED);
        createDTO.setTitle("Test Notification");
        createDTO.setMessage("This is a test notification");
        createDTO.setSeverity(NotificationSeverity.INFO);

        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(notificationRepository.saveAndFlush(any(Notification.class))).thenReturn(testNotification);
        when(modelMapper.map(testNotification, NotificationDTO.class)).thenReturn(testNotificationDTO);
        when(notificationRepository.countUnreadByUserId(userId)).thenReturn(1L);

        NotificationDTO result = notificationService.createNotification(createDTO);

        assertNotNull(result);
        assertEquals("Test Notification", result.getTitle());
        verify(notificationRepository, times(1)).saveAndFlush(any(Notification.class));
        verify(messagingTemplate, atLeastOnce()).convertAndSendToUser(eq(userId.toString()), anyString(), any());
    }

    @Test
    @DisplayName("createNotification returns dto even if broadcast fails")
    void testCreateNotification_BroadcastFailure() {
        NotificationCreateDTO createDTO = new NotificationCreateDTO();
        createDTO.setUserId(userId);
        createDTO.setType(NotificationType.TASK_ASSIGNED);
        createDTO.setTitle("Test Notification");
        createDTO.setMessage("This is a test notification");
        createDTO.setSeverity(NotificationSeverity.INFO);

        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(notificationRepository.saveAndFlush(any(Notification.class))).thenReturn(testNotification);
        when(modelMapper.map(testNotification, NotificationDTO.class)).thenReturn(testNotificationDTO);
        when(notificationRepository.countUnreadByUserId(userId)).thenReturn(1L);
        doNothing()
            .doThrow(new RuntimeException("ws down"))
            .when(messagingTemplate).convertAndSendToUser(eq(userId.toString()), anyString(), any());

        NotificationDTO result = notificationService.createNotification(createDTO);

        assertNotNull(result);
        verify(notificationRepository).saveAndFlush(any(Notification.class));
    }

    @Test
    @DisplayName("Should retrieve notifications for user")
    void testGetNotificationsByUser_Success() {
        List<Notification> notifications = List.of(testNotification);

        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(notificationRepository.findByUserIdAndCompanyIdOrderByCreatedAtDesc(eq(userId), any()))
                .thenReturn(notifications);
        when(modelMapper.map(testNotification, NotificationDTO.class)).thenReturn(testNotificationDTO);

        List<NotificationDTO> result = notificationService.getNotificationsByUser(userId);

        assertNotNull(result);
        assertEquals(1, result.size());
        verify(notificationRepository, times(1)).findByUserIdAndCompanyIdOrderByCreatedAtDesc(eq(userId), any());
    }

    @Test
    @DisplayName("Should retrieve unread notifications for user")
    void testGetUnreadNotifications_Success() {
        List<Notification> notifications = List.of(testNotification);

        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(notificationRepository.findUnreadByUserIdAndCompanyId(eq(userId), any())).thenReturn(notifications);
        when(modelMapper.map(testNotification, NotificationDTO.class)).thenReturn(testNotificationDTO);

        List<NotificationDTO> result = notificationService.getUnreadNotifications(userId);

        assertNotNull(result);
        assertEquals(1, result.size());
        verify(notificationRepository, times(1)).findUnreadByUserIdAndCompanyId(eq(userId), any());
    }

    @Test
    @DisplayName("Should mark notification as read")
    void testMarkAsRead_Success() {
        when(notificationRepository.findById(notificationId)).thenReturn(Optional.of(testNotification));
        when(notificationRepository.saveAndFlush(any(Notification.class))).thenReturn(testNotification);
        when(notificationRepository.countUnreadByUserId(userId)).thenReturn(0L);
        when(modelMapper.map(any(Notification.class), eq(NotificationDTO.class))).thenReturn(testNotificationDTO);

        NotificationDTO dto = notificationService.markAsRead(notificationId);

        assertNotNull(dto);
        verify(notificationRepository, times(1)).saveAndFlush(any(Notification.class));
    }

    @Test
    @DisplayName("Should delete notification successfully")
    void testDeleteNotification_Success() {
        when(notificationRepository.existsById(notificationId)).thenReturn(true);

        notificationService.deleteNotification(notificationId);

        verify(notificationRepository, times(1)).deleteById(notificationId);
    }

    @Test
    @DisplayName("createNotification broadcasts promotion payload when type is ROLE_PROMOTION")
    void testCreateNotification_RolePromotionBroadcast() {
        NotificationCreateDTO createDTO = new NotificationCreateDTO();
        createDTO.setUserId(userId);
        createDTO.setType(NotificationType.ROLE_PROMOTION);
        createDTO.setTitle("Promoted");
        createDTO.setMessage("You are now manager");
        createDTO.setSeverity(NotificationSeverity.SUCCESS);

        testNotification.setType(NotificationType.ROLE_PROMOTION);
        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(notificationRepository.saveAndFlush(any(Notification.class))).thenReturn(testNotification);
        when(modelMapper.map(testNotification, NotificationDTO.class)).thenReturn(testNotificationDTO);
        when(notificationRepository.countUnreadByUserId(userId)).thenReturn(1L);

        notificationService.createNotification(createDTO);
        verify(messagingTemplate, atLeast(2)).convertAndSendToUser(eq(userId.toString()), eq("/queue/notifications"),
                any());
    }

    @Test
    @DisplayName("markAllAsRead marks unread notifications and broadcasts count zero")
    void testMarkAllAsRead_Success() {
        Notification n1 = new Notification();
        n1.setId(UUID.randomUUID());
        n1.setIsRead(false);
        Notification n2 = new Notification();
        n2.setId(UUID.randomUUID());
        n2.setIsRead(false);
        when(notificationRepository.findUnreadByUserId(userId)).thenReturn(List.of(n1, n2));

        notificationService.markAllAsRead(userId);
        assertTrue(n1.getIsRead());
        assertTrue(n2.getIsRead());
        verify(notificationRepository).saveAllAndFlush(anyList());
        verify(messagingTemplate).convertAndSendToUser(eq(userId.toString()), eq("/queue/notification-update"), any());
    }

    @Test
    @DisplayName("notifyTeamMembers creates one notification per member")
    void testNotifyTeamMembers_SendsToAll() {
        User u1 = new User();
        u1.setId(UUID.randomUUID());
        User u2 = new User();
        u2.setId(UUID.randomUUID());
        when(userRepository.findByTeamId(any(UUID.class))).thenReturn(List.of(u1, u2));
        when(userRepository.findById(any(UUID.class))).thenReturn(Optional.of(user));
        when(notificationRepository.saveAndFlush(any(Notification.class))).thenReturn(testNotification);
        when(modelMapper.map(any(Notification.class), eq(NotificationDTO.class))).thenReturn(testNotificationDTO);
        when(notificationRepository.countUnreadByUserId(any(UUID.class))).thenReturn(1L);

        notificationService.notifyTeamMembers(UUID.randomUUID(), "Team", "Updated", NotificationSeverity.INFO);
        verify(notificationRepository, times(2)).saveAndFlush(any(Notification.class));
    }

    @Test
    @DisplayName("getNotificationsByUser uses userId query when user has no company")
    void testGetNotificationsByUser_NoCompany() {
        user.setCompany(null);
        List<Notification> notifications = List.of(testNotification);

        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(notificationRepository.findByUserIdOrderByCreatedAtDesc(userId)).thenReturn(notifications);
        when(modelMapper.map(testNotification, NotificationDTO.class)).thenReturn(testNotificationDTO);

        List<NotificationDTO> result = notificationService.getNotificationsByUser(userId);

        assertEquals(1, result.size());
        verify(notificationRepository, times(1)).findByUserIdOrderByCreatedAtDesc(userId);
        verify(notificationRepository, never()).findByUserIdAndCompanyIdOrderByCreatedAtDesc(any(), any());
    }

    @Test
    @DisplayName("getUnreadNotifications uses userId query when user has no company")
    void testGetUnreadNotifications_NoCompany() {
        user.setCompany(null);
        List<Notification> notifications = List.of(testNotification);

        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(notificationRepository.findUnreadByUserId(userId)).thenReturn(notifications);
        when(modelMapper.map(testNotification, NotificationDTO.class)).thenReturn(testNotificationDTO);

        List<NotificationDTO> result = notificationService.getUnreadNotifications(userId);

        assertEquals(1, result.size());
        verify(notificationRepository, times(1)).findUnreadByUserId(userId);
        verify(notificationRepository, never()).findUnreadByUserIdAndCompanyId(any(), any());
    }

    @Test
    @DisplayName("getUnreadCount uses userId query when user has no company")
    void testGetUnreadCount_NoCompany() {
        user.setCompany(null);
        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(notificationRepository.countUnreadByUserId(userId)).thenReturn(3L);

        Long count = notificationService.getUnreadCount(userId);

        assertEquals(3L, count);
        verify(notificationRepository, times(1)).countUnreadByUserId(userId);
        verify(notificationRepository, never()).countUnreadByUserIdAndCompanyId(any(), any());
    }

    @Test
    @DisplayName("getUnreadCount uses company scoped query when company exists")
    void testGetUnreadCount_WithCompany() {
        UUID companyId = user.getCompany().getId();
        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(notificationRepository.countUnreadByUserIdAndCompanyId(userId, companyId)).thenReturn(4L);

        Long count = notificationService.getUnreadCount(userId);

        assertEquals(4L, count);
        verify(notificationRepository).countUnreadByUserIdAndCompanyId(userId, companyId);
        verify(notificationRepository, never()).countUnreadByUserId(userId);
    }

    @Test
    @DisplayName("markAsRead does not save when notification already read")
    void testMarkAsRead_AlreadyRead() {
        testNotification.setIsRead(true);
        when(notificationRepository.findById(notificationId)).thenReturn(Optional.of(testNotification));
        when(modelMapper.map(testNotification, NotificationDTO.class)).thenReturn(testNotificationDTO);

        NotificationDTO dto = notificationService.markAsRead(notificationId);

        assertNotNull(dto);
        verify(notificationRepository, never()).saveAndFlush(any(Notification.class));
    }

    @Test
    @DisplayName("deleteNotification throws when notification is missing")
    void testDeleteNotification_NotFound() {
        when(notificationRepository.existsById(notificationId)).thenReturn(false);
        assertThrows(ResourceNotFoundException.class, () -> notificationService.deleteNotification(notificationId));
        verify(notificationRepository, never()).deleteById(any(UUID.class));
    }

    @Test
    @DisplayName("createNotification defaults severity to INFO when missing")
    void testCreateNotification_DefaultSeverity() {
        NotificationCreateDTO createDTO = new NotificationCreateDTO();
        createDTO.setUserId(userId);
        createDTO.setType(NotificationType.TASK_ASSIGNED);
        createDTO.setTitle("Title");
        createDTO.setMessage("Body");
        createDTO.setSeverity(null);

        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(notificationRepository.saveAndFlush(any(Notification.class))).thenReturn(testNotification);
        when(modelMapper.map(testNotification, NotificationDTO.class)).thenReturn(testNotificationDTO);
        when(notificationRepository.countUnreadByUserId(userId)).thenReturn(2L);

        NotificationDTO dto = notificationService.createNotification(createDTO);

        assertNotNull(dto);
        verify(notificationRepository).saveAndFlush(any(Notification.class));
    }

    @Test
    @DisplayName("markAllAsRead with no unread notifications still broadcasts zero count")
    void testMarkAllAsRead_EmptyList() {
        when(notificationRepository.findUnreadByUserId(userId)).thenReturn(List.of());
        notificationService.markAllAsRead(userId);
        verify(notificationRepository).saveAllAndFlush(anyList());
        verify(messagingTemplate).convertAndSendToUser(eq(userId.toString()), eq("/queue/notification-update"), any());
    }
}
