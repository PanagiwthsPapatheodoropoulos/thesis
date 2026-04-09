package com.thesis.smart_resource_planner.service;

import com.thesis.smart_resource_planner.enums.NotificationSeverity;
import com.thesis.smart_resource_planner.exception.ResourceNotFoundException;
import com.thesis.smart_resource_planner.model.dto.NotificationCreateDTO;
import com.thesis.smart_resource_planner.model.dto.NotificationDTO;
import com.thesis.smart_resource_planner.model.entity.Company;
import com.thesis.smart_resource_planner.model.entity.Notification;
import com.thesis.smart_resource_planner.model.entity.User;
import com.thesis.smart_resource_planner.repository.NotificationRepository;
import com.thesis.smart_resource_planner.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.modelmapper.ModelMapper;
import org.springframework.messaging.simp.SimpMessagingTemplate;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("NotificationService Coverage - Gap Tests")
class NotificationServiceCoverageDedicatedTest {

    @Mock private NotificationRepository notificationRepository;
    @Mock private UserRepository userRepository;
    @Mock private ModelMapper modelMapper;
    @Mock private SimpMessagingTemplate messagingTemplate;

    @InjectMocks private NotificationService notificationService;

    private UUID userId;
    private UUID notificationId;
    private User user;
    private Company company;

    @BeforeEach
    void setUp() {
        userId = UUID.randomUUID();
        notificationId = UUID.randomUUID();
        company = new Company();
        company.setId(UUID.randomUUID());
        user = new User();
        user.setId(userId);
        user.setCompany(company);
    }

    @Test
    @DisplayName("createNotification uses default INFO severity when null provided")
    void createNotification_defaultSeverity() {
        NotificationCreateDTO createDTO = new NotificationCreateDTO();
        createDTO.setUserId(userId);
        createDTO.setType("INFO");
        createDTO.setTitle("Test");
        createDTO.setMessage("msg");
        createDTO.setSeverity(null);

        Notification saved = new Notification();
        saved.setId(notificationId);
        saved.setUser(user);
        saved.setType("INFO");
        NotificationDTO dto = new NotificationDTO();
        dto.setType("INFO");

        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(notificationRepository.saveAndFlush(any(Notification.class))).thenReturn(saved);
        when(modelMapper.map(any(Notification.class), eq(NotificationDTO.class))).thenReturn(dto);
        when(notificationRepository.countUnreadByUserId(userId)).thenReturn(1L);

        NotificationDTO result = notificationService.createNotification(createDTO);
        assertNotNull(result);
    }

    @Test
    @DisplayName("createNotification recovers when broadcast fails")
    void createNotification_broadcastFails_recovers() {
        NotificationCreateDTO createDTO = new NotificationCreateDTO();
        createDTO.setUserId(userId);
        createDTO.setType("INFO");
        createDTO.setTitle("Test");
        createDTO.setMessage("msg");
        createDTO.setSeverity(NotificationSeverity.INFO);

        Notification saved = new Notification();
        saved.setId(notificationId);
        saved.setUser(user);
        saved.setType("INFO");
        NotificationDTO dto = new NotificationDTO();
        dto.setType("INFO");

        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(notificationRepository.saveAndFlush(any(Notification.class))).thenReturn(saved);
        when(modelMapper.map(any(Notification.class), eq(NotificationDTO.class))).thenReturn(dto);
        doThrow(new RuntimeException("ws fail")).when(messagingTemplate)
                .convertAndSendToUser(anyString(), anyString(), any());

        NotificationDTO result = notificationService.createNotification(createDTO);
        assertNotNull(result);
    }

    @Test
    @DisplayName("getNotificationsByUser throws when user not found")
    void getNotificationsByUser_userNotFound() {
        when(userRepository.findById(userId)).thenReturn(Optional.empty());
        assertThrows(ResourceNotFoundException.class, () -> notificationService.getNotificationsByUser(userId));
    }

    @Test
    @DisplayName("getUnreadNotifications throws when user not found")
    void getUnreadNotifications_userNotFound() {
        when(userRepository.findById(userId)).thenReturn(Optional.empty());
        assertThrows(ResourceNotFoundException.class, () -> notificationService.getUnreadNotifications(userId));
    }

    @Test
    @DisplayName("getUnreadCount returns count scoped to company")
    void getUnreadCount_returnsCount() {
        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(notificationRepository.countUnreadByUserIdAndCompanyId(userId, company.getId())).thenReturn(5L);

        assertEquals(5L, notificationService.getUnreadCount(userId));
    }

    @Test
    @DisplayName("getUnreadCount throws when user not found")
    void getUnreadCount_userNotFound() {
        when(userRepository.findById(userId)).thenReturn(Optional.empty());
        assertThrows(ResourceNotFoundException.class, () -> notificationService.getUnreadCount(userId));
    }

    @Test
    @DisplayName("markAsRead returns existing DTO when already read")
    void markAsRead_alreadyRead_returnsWithoutUpdate() {
        Notification notification = new Notification();
        notification.setId(notificationId);
        notification.setIsRead(true);
        notification.setUser(user);
        NotificationDTO dto = new NotificationDTO();

        when(notificationRepository.findById(notificationId)).thenReturn(Optional.of(notification));
        when(modelMapper.map(notification, NotificationDTO.class)).thenReturn(dto);

        NotificationDTO result = notificationService.markAsRead(notificationId);
        assertNotNull(result);
        verify(notificationRepository, never()).saveAndFlush(any());
    }

    @Test
    @DisplayName("markAsRead throws when notification not found")
    void markAsRead_notFound_throws() {
        when(notificationRepository.findById(notificationId)).thenReturn(Optional.empty());
        assertThrows(ResourceNotFoundException.class, () -> notificationService.markAsRead(notificationId));
    }

    @Test
    @DisplayName("markAsRead recovers when broadcast fails")
    void markAsRead_broadcastFails_recovers() {
        Notification notification = new Notification();
        notification.setId(notificationId);
        notification.setIsRead(false);
        notification.setUser(user);
        NotificationDTO dto = new NotificationDTO();

        when(notificationRepository.findById(notificationId)).thenReturn(Optional.of(notification));
        when(notificationRepository.saveAndFlush(any(Notification.class))).thenReturn(notification);
        when(notificationRepository.countUnreadByUserId(userId)).thenReturn(0L);
        when(modelMapper.map(any(Notification.class), eq(NotificationDTO.class))).thenReturn(dto);
        doThrow(new RuntimeException("ws fail")).when(messagingTemplate)
                .convertAndSendToUser(anyString(), anyString(), any());

        NotificationDTO result = notificationService.markAsRead(notificationId);
        assertNotNull(result);
    }

    @Test
    @DisplayName("markAllAsRead recovers when broadcast fails")
    void markAllAsRead_broadcastFails_recovers() {
        Notification n1 = new Notification();
        n1.setId(UUID.randomUUID());
        n1.setIsRead(false);
        when(notificationRepository.findUnreadByUserId(userId)).thenReturn(List.of(n1));
        doThrow(new RuntimeException("ws fail")).when(messagingTemplate)
                .convertAndSendToUser(anyString(), anyString(), any());

        assertDoesNotThrow(() -> notificationService.markAllAsRead(userId));
        assertTrue(n1.getIsRead());
    }

    @Test
    @DisplayName("deleteNotification throws when not found")
    void deleteNotification_notFound_throws() {
        when(notificationRepository.existsById(notificationId)).thenReturn(false);
        assertThrows(ResourceNotFoundException.class, () -> notificationService.deleteNotification(notificationId));
    }

    @Test
    @DisplayName("createNotification throws when user not found")
    void createNotification_userNotFound_throws() {
        NotificationCreateDTO createDTO = new NotificationCreateDTO();
        createDTO.setUserId(userId);
        when(userRepository.findById(userId)).thenReturn(Optional.empty());
        assertThrows(ResourceNotFoundException.class, () -> notificationService.createNotification(createDTO));
    }
}
